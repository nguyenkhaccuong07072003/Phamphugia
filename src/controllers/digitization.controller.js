const fs = require("fs");
const path = require("path");
const {
  DocumentTemplate,
  DocumentSubmission,
  User,
  Department,
  Company,
  sequelize,
} = require("../models");
const { Op, QueryTypes } = require("sequelize");
const asyncHandler = require("../utils/asyncHandler");
const ApiError = require("../utils/ApiError");
const { successResponse, paginatedResponse } = require("../utils/response");
const { slugify } = require("../utils/slugify");
const { parsePagination } = require("../utils/pagination");
const {
  generateDocument,
  parseBlanks,
  parseBlanksByLine,
} = require("../utils/documentGenerator");
const { docxToPdf } = require("../utils/docxToPdf");

/** `/uploads/generated/...` → đường dẫn tuyệt đối dưới project root (tránh lệch khi join với URL có `/` đầu). */
function uploadsAbsPath(relativeUrl) {
  if (!relativeUrl) return null;
  const rel = String(relativeUrl).replace(/^\/+/, "");
  return path.normalize(path.join(__dirname, "..", "..", rel));
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Chờ job PDF nền (sau submit) ghi file xong — giảm đua /print với Word vừa khởi.
 * Poll ngắn để bắt file sớm khi Word xong (giảm ~200ms chờ so với 300ms).
 */
async function waitForBackgroundPdfIfAny(pdfPath, docxPath) {
  /** Không chờ quá lâu — request /print bị treo spinner phía client (trước khi Word chạy). */
  const deadline = Date.now() + 12000;
  const pollMs = 120;
  while (Date.now() < deadline) {
    if (fs.existsSync(pdfPath)) {
      try {
        const pdfStat = fs.statSync(pdfPath);
        if (pdfStat.size === 0) {
          await sleep(pollMs);
          continue;
        }
        if (!fs.existsSync(docxPath)) return;
        const docStat = fs.statSync(docxPath);
        if (pdfStat.mtimeMs >= docStat.mtimeMs) return;
      } catch {
        /* ignore */
      }
    }
    await sleep(pollMs);
  }
}

/**
 * Xóa file trong uploads/generated; retry khi EBUSY/EPERM (Word COM / antivirus giữ file trên Windows).
 * Không throw — tránh 500 khi vẫn cần xóa bản ghi DB.
 */
async function tryUnlinkGeneratedFile(absPath) {
  if (!absPath || !fs.existsSync(absPath)) return;
  const maxAttempts = 10;
  const delayMs = 300;
  for (let i = 0; i < maxAttempts; i++) {
    try {
      await fs.promises.unlink(absPath);
      return;
    } catch (err) {
      if (err.code === "ENOENT") return;
      if ((err.code === "EBUSY" || err.code === "EPERM") && i < maxAttempts - 1) {
        await sleep(delayMs);
        continue;
      }
      return;
    }
  }
}

/** Tên hiển thị / tải: bỏ ký tự không hợp lệ trên Windows. */
function sanitizeFilenameBase(name) {
  return (
    String(name || "document")
      .replace(/[\\/:*?"<>|]/g, "_")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 120) || "document"
  );
}

/** `prior` = số submission cùng mẫu + cùng user có id nhỏ hơn bản hiện tại. */
function displayBasenameFromPrior(submission, prior) {
  const base = sanitizeFilenameBase(submission.template?.name);
  if (prior === 0) return base;
  return `${base} (${prior})`;
}

/**
 * Cùng mẫu + cùng người nộp: bản đầu = "Tên mẫu", bản sau = "Tên mẫu (1)", "Tên mẫu (2)"...
 */
async function getSubmissionDisplayBasename(submission) {
  const prior = await DocumentSubmission.count({
    where: {
      template_id: submission.template_id,
      submitted_by: submission.submitted_by,
      id: { [Op.lt]: submission.id },
    },
  });
  return displayBasenameFromPrior(submission, prior);
}

/** Một query lấy `prior` cho nhiều id — tránh N+1 ở danh sách submission. */
async function fetchPriorCountsBySubmissionIds(ids) {
  if (!ids.length) return new Map();
  const rows = await sequelize.query(
    `SELECT s1.id AS id,
      (SELECT COUNT(*)::integer FROM document_submissions AS s2
       WHERE s2.template_id = s1.template_id
         AND s2.submitted_by = s1.submitted_by
         AND s2.id < s1.id) AS prior
     FROM document_submissions AS s1
     WHERE s1.id IN (:ids)`,
    { replacements: { ids }, type: QueryTypes.SELECT },
  );
  return new Map(rows.map((r) => [Number(r.id), Number(r.prior)]));
}

function buildAttachmentContentDisposition(filename) {
  const enc = encodeURIComponent(filename);
  const ascii = filename.replace(/[^\x20-\x7E]/g, "_");
  return `attachment; filename="${ascii.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"; filename*=UTF-8''${enc}`;
}

function buildInlineContentDisposition(filename) {
  const enc = encodeURIComponent(filename);
  const ascii = filename.replace(/[^\x20-\x7E]/g, "_");
  return `inline; filename="${ascii.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"; filename*=UTF-8''${enc}`;
}

function attachDisplayFilenames(displayBase, templateType) {
  return {
    display_filename_base: displayBase,
    display_filename: `${displayBase}.${templateType}`,
    display_filename_pdf:
      templateType === "docx" ? `${displayBase}.pdf` : undefined,
  };
}

// ============ PUBLIC ============

// GET /api/public/digitization/templates
exports.getPublicTemplates = asyncHandler(async (req, res) => {
  const { page, limit, offset } = parsePagination(req.query);
  const {
    category,
    search,
    department_slug,
    company_id,
    company_slug,
    company,
  } = req.query;

  const where = { is_active: true };
  if (category) where.category = category;
  if (search) where.name = { [Op.iLike]: `%${search}%` };

  // Handle công ty filter:
  // Ưu tiên slug (company_slug hoặc company), fallback sang company_id (giữ tương thích cũ)
  // - "null" => chỉ template có company_id IS NULL
  // - 1 slug/ID cụ thể => template có company_id đó HOẶC company_id IS NULL (dùng chung)
  const rawCompanyId = company_id;
  const rawCompanySlug = company_slug || company;

  if (rawCompanyId === "null" || rawCompanySlug === "null") {
    where.company_id = null;
  } else if (rawCompanySlug) {
    const companyRow = await Company.findOne({
      where: { slug: rawCompanySlug },
      attributes: ["id"],
    });
    if (companyRow) {
      where.company_id = {
        [Op.or]: [{ [Op.eq]: companyRow.id }, { [Op.is]: null }],
      };
    } else {
      // Không tìm thấy company theo slug → không có template nào
      return paginatedResponse(res, [], 0, page, limit);
    }
  } else if (rawCompanyId) {
    where.company_id = {
      [Op.or]: [{ [Op.eq]: parseInt(rawCompanyId) }, { [Op.is]: null }],
    };
  }

  // Filter by department slug
  if (department_slug) {
    const dept = await Department.findOne({ where: { slug: department_slug } });
    if (dept) {
      where.department_id = dept.id;
    } else {
      return paginatedResponse(res, [], 0, page, limit);
    }
  }

  const { count, rows } = await DocumentTemplate.findAndCountAll({
    where,
    attributes: [
      "id",
      "name",
      "slug",
      "description",
      "template_type",
      "category",
      "icon",
      "sort_order",
      "department_id",
      "company_id",
    ],
    include: [
      {
        model: Department,
        as: "department",
        attributes: ["id", "name", "slug"],
      },
    ],
    order: [
      ["sort_order", "ASC"],
      ["created_at", "DESC"],
    ],
    limit,
    offset,
  });

  return paginatedResponse(res, rows, count, page, limit);
});

// GET /api/public/digitization/templates/:slug
exports.getPublicTemplateBySlug = asyncHandler(async (req, res) => {
  const { company_id, company_slug, company } = req.query;

  const where = { slug: req.params.slug, is_active: true };

  // Cùng logic filter công ty như getPublicTemplates (ưu tiên slug)
  const rawCompanyId = company_id;
  const rawCompanySlug = company_slug || company;

  if (rawCompanyId === "null" || rawCompanySlug === "null") {
    where.company_id = null;
  } else if (rawCompanySlug) {
    const companyRow = await Company.findOne({
      where: { slug: rawCompanySlug },
      attributes: ["id"],
    });
    if (companyRow) {
      where.company_id = {
        [Op.or]: [{ [Op.eq]: companyRow.id }, { [Op.is]: null }],
      };
    } else {
      // Không có company này → coi như template không khả dụng
      const tmpl = await DocumentTemplate.findOne({
        where: { slug: req.params.slug, is_active: true },
      });
      if (!tmpl) {
        throw new ApiError(404, "Template not found");
      }
      // Có template nhưng không áp dụng cho company này
      throw new ApiError(404, "Template not available for this company");
    }
  } else if (rawCompanyId) {
    where.company_id = {
      [Op.or]: [{ [Op.eq]: parseInt(rawCompanyId) }, { [Op.is]: null }],
    };
  }

  const template = await DocumentTemplate.findOne({
    where,
    attributes: [
      "id",
      "name",
      "slug",
      "description",
      "template_type",
      "template_file_url",
      "questions",
      "category",
      "icon",
      "department_id",
      "company_id",
    ],
    include: [
      {
        model: Department,
        as: "department",
        attributes: ["id", "name", "slug"],
      },
    ],
  });

  if (!template) throw new ApiError(404, "Template not found");
  return successResponse(res, template);
});

// ============ AUTHENTICATED (user submissions) ============

// POST /api/admin/digitization/submit/:templateId
exports.submitForm = asyncHandler(async (req, res) => {
  const template = await DocumentTemplate.findByPk(req.params.templateId);
  if (!template) throw new ApiError(404, "Template not found");
  if (!template.is_active) throw new ApiError(400, "Template is not active");

  // Verify template file blanks match saved config
  const templateFilePath = path.join(
    __dirname,
    "../../",
    template.template_file_url,
  );
  const actualBlanks = await parseBlanks(
    templateFilePath,
    template.template_type,
  );
  const savedBlanksCount = template.blanks?.length || 0;
  if (savedBlanksCount > 0 && actualBlanks.length !== savedBlanksCount) {
    throw new ApiError(
      400,
      `File template có ${actualBlanks.length} chỗ trống nhưng cấu hình lưu ${savedBlanksCount}. ` +
        `Admin cần cập nhật lại template.`,
    );
  }

  const { answers } = req.body;

  // All fields are optional — empty fields keep original dots in the template

  // --- Dynamic row expansion: detect rowPattern questions and compute expansions ---
  // Deep-clone questions so we can modify blankMapping without affecting DB
  const questions = JSON.parse(JSON.stringify(template.questions));

  const dynamicExpansions = [];

  function processRowPattern(q) {
    if (q.type !== "dynamic_table" || !q.rowPattern) return;
    const { templateRows, blanksPerRow, startBlank, columnOrder } =
      q.rowPattern;
    if (startBlank == null || startBlank < 0) return; // not configured yet
    if (!blanksPerRow || blanksPerRow <= 0) return; // no columns configured
    const tableData = answers[q.key];
    const actualRows = Array.isArray(tableData) ? tableData.length : 0;
    if (actualRows === 0) return;

    // Exclude textReplace columns — they don't occupy blank positions (dots)
    const textReplaceCols = new Set();
    if (q.tableColumns) {
      for (const col of q.tableColumns) {
        if (col.textReplace) textReplaceCols.add(col.key);
      }
    }
    const fillableColumns = columnOrder.filter((k) => !textReplaceCols.has(k));
    // Effective blanksPerRow = admin override if set, otherwise = fillable columns count
    const effectiveBlanksPerRow =
      blanksPerRow > fillableColumns.length
        ? blanksPerRow
        : fillableColumns.length;

    const extraRows = actualRows - templateRows; // positive = expand, negative = shrink
    if (extraRows !== 0) {
      dynamicExpansions.push({
        startBlank,
        blanksPerRow: effectiveBlanksPerRow,
        templateRows,
        extraRows,
      });
    }

    // Auto-generate blankMapping from rowPattern
    const blankMapping = {};
    for (let colIdx = 0; colIdx < fillableColumns.length; colIdx++) {
      const colKey = fillableColumns[colIdx];
      blankMapping[colKey] = [];
      for (let row = 0; row < actualRows; row++) {
        blankMapping[colKey].push(
          startBlank + row * effectiveBlanksPerRow + colIdx,
        );
      }
    }
    // Fill extra blanks (effectiveBlanksPerRow > fillable columns) with empty string to clear leftover dots
    if (effectiveBlanksPerRow > fillableColumns.length) {
      blankMapping["__extra__"] = [];
      for (
        let colIdx = fillableColumns.length;
        colIdx < effectiveBlanksPerRow;
        colIdx++
      ) {
        for (let row = 0; row < actualRows; row++) {
          blankMapping["__extra__"].push(
            startBlank + row * effectiveBlanksPerRow + colIdx,
          );
        }
      }
    }
    q.blankMapping = blankMapping;
  }

  for (const q of questions) {
    if (q.type === "group") {
      for (const child of q.children || []) processRowPattern(child);
    } else {
      processRowPattern(q);
    }
  }

  // Adjust blank indices for other questions when rows were expanded/shrunk
  // (inserted/removed blanks shift all blanks after the expansion zone)
  if (dynamicExpansions.length > 0) {
    const sortedExp = [...dynamicExpansions].sort(
      (a, b) => a.startBlank - b.startBlank,
    );

    // shiftIndex: compute how much a blank index moves due to expansions/shrinks
    // excludeStartBlank: skip the expansion that owns this blank (for rowPattern self-mapping)
    function shiftIndex(idx, excludeStartBlank) {
      let shift = 0;
      for (const exp of sortedExp) {
        if (exp.startBlank === excludeStartBlank) continue;
        const insertionPoint =
          exp.startBlank + exp.templateRows * exp.blanksPerRow;
        if (idx >= insertionPoint) {
          shift += exp.extraRows * exp.blanksPerRow;
        }
      }
      return idx + shift;
    }

    function adjustQuestion(q) {
      // For rowPattern questions: shift blankMapping by OTHER expansions only
      // (their own expansion indices are already correct from processRowPattern)
      const excludeOwn = q.rowPattern ? q.rowPattern.startBlank : undefined;
      if (q.blankIndex != null)
        q.blankIndex = shiftIndex(q.blankIndex, excludeOwn);
      if (q.blankIndices)
        q.blankIndices = q.blankIndices.map((i) =>
          i != null ? shiftIndex(i, excludeOwn) : null,
        );
      if (q.blankMapping) {
        for (const [col, indices] of Object.entries(q.blankMapping)) {
          q.blankMapping[col] = indices.map((i) =>
            i != null ? shiftIndex(i, excludeOwn) : null,
          );
        }
      }
    }

    for (const q of questions) {
      if (q.type === "group") {
        for (const child of q.children || []) adjustQuestion(child);
      } else {
        adjustQuestion(q);
      }
    }
  }

  // Check if template uses explicit blank mapping (blankIndices or legacy blankIndex)
  const hasBlankMapping = questions.some(
    (q) =>
      q.blankIndices?.length > 0 ||
      q.blankIndex != null ||
      q.blankMapping != null ||
      (q.type === "group" &&
        q.children?.some(
          (c) =>
            c.blankIndices?.length > 0 ||
            c.blankIndex != null ||
            c.blankMapping != null,
        )),
  );

  let indexedAnswers;
  let assignedIndices = null;

  // Helper: get effective blank indices for a question (supports both new blankIndices and legacy blankIndex)
  function getBlankIndices(q) {
    if (q.blankIndices && q.blankIndices.length > 0) return q.blankIndices;
    if (q.blankIndex != null) return [q.blankIndex];
    return [];
  }

  // Helper: process a question's value according to its fillRule and fill the blank indices
  function fillQuestion(q, indexedAnswers, assignedIndices, allAnswers) {
    // Skip dots fill for questions that only do text replacement (e.g. gender → Ông/Bà)
    if (q.textReplace) return;
    const indices = getBlankIndices(q);
    if (indices.length === 0) return;

    const rawVal = allAnswers[q.key];
    const val = rawVal !== undefined && rawVal !== null ? rawVal : "";

    // Fill rule: split_date — split "YYYY-MM-DD" or "DD/MM/YYYY" into [day, month, year] parts
    if (q.fillRule === "split_date" && indices.length >= 3) {
      if (!val) return; // empty → keep dots
      let day = "",
        month = "",
        year = "";
      if (typeof val === "string" && val) {
        if (val.includes("-")) {
          // ISO format: YYYY-MM-DD
          const parts = val.split("-");
          year = parts[0] || "";
          month = parts[1] || "";
          day = parts[2] || "";
        } else if (val.includes("/")) {
          // DD/MM/YYYY
          const parts = val.split("/");
          day = parts[0] || "";
          month = parts[1] || "";
          year = parts[2] || "";
        }
      }
      const dateParts = [day, month, year];
      for (let i = 0; i < indices.length && i < dateParts.length; i++) {
        indexedAnswers[String(indices[i])] = dateParts[i];
        assignedIndices.add(indices[i]);
      }
      return;
    }

    // Fill rule: split_datetime — split into [hour, minute, day, month, year]
    if (q.fillRule === "split_datetime" && indices.length >= 5) {
      if (!val) return; // empty → keep dots
      let hour = "",
        minute = "",
        day = "",
        month = "",
        year = "";
      if (typeof val === "string" && val) {
        // Expect "YYYY-MM-DDThh:mm" or "DD/MM/YYYY hh:mm" or "hh:mm DD/MM/YYYY"
        const isoMatch = val.match(
          /(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/,
        );
        if (isoMatch) {
          year = isoMatch[1];
          month = isoMatch[2];
          day = isoMatch[3];
          hour = isoMatch[4];
          minute = isoMatch[5];
        } else {
          const altMatch = val.match(
            /(\d{2}):(\d{2}).*?(\d{1,2})[/\-](\d{1,2})[/\-](\d{4})/,
          );
          if (altMatch) {
            hour = altMatch[1];
            minute = altMatch[2];
            day = altMatch[3];
            month = altMatch[4];
            year = altMatch[5];
          }
        }
      }
      const dtParts = [hour, minute, day, month, year];
      for (let i = 0; i < indices.length && i < dtParts.length; i++) {
        indexedAnswers[String(indices[i])] = dtParts[i];
        assignedIndices.add(indices[i]);
      }
      return;
    }

    // Fill rule: split_time — split "hh:mm" into [hour, minute]
    // Also auto-split when type=time and has 2+ blanks (template already has giờ/phút text)
    if (
      (q.fillRule === "split_time" || (q.type === "time" && !q.fillRule)) &&
      indices.length >= 2
    ) {
      if (!val) return; // empty → keep dots
      let hour = "",
        minute = "";
      if (typeof val === "string" && val) {
        const parts = val.split(":");
        hour = parts[0] || "";
        minute = parts[1] || "";
      }
      const timeParts = [hour, minute];
      for (let i = 0; i < indices.length && i < timeParts.length; i++) {
        indexedAnswers[String(indices[i])] = timeParts[i];
        assignedIndices.add(indices[i]);
      }
      return;
    }

    // Default: fill all specified blanks with the same value
    // Skip if val is empty — keep original dots in the template
    if (val === "" || val === undefined || val === null) return;
    let fillVal = String(val);
    // Auto-format time: "14:05" → "14 giờ 05 phút" (only when 1 blank — template has no giờ/phút text)
    if (q.type === "time" && indices.length === 1) {
      const timeMatch = fillVal.match(/^(\d{1,2}):(\d{2})$/);
      if (timeMatch) fillVal = `${timeMatch[1]} giờ ${timeMatch[2]} phút`;
    }
    for (const idx of indices) {
      indexedAnswers[String(idx)] = fillVal;
      assignedIndices.add(idx);
    }
  }

  // Helper: process dynamic_table blankMapping — fill table row data into repeating blank positions
  function fillDynamicTable(q, indexedAnswers, assignedIndices, allAnswers) {
    if (!q.blankMapping || q.type !== "dynamic_table") return;
    const tableData = allAnswers[q.key]; // array of row objects
    if (!Array.isArray(tableData)) return;

    // blankMapping: { colKey: [blankIdx_for_row0, blankIdx_for_row1, ...], ... }
    const mapping = q.blankMapping;
    const columnsByKey = {};
    if (Array.isArray(q.tableColumns)) {
      for (const col of q.tableColumns) {
        if (col && col.key) columnsByKey[col.key] = col;
      }
    }
    // Build set of columns that only do text replacement (skip dots fill)
    const textReplaceCols = new Set();
    if (q.tableColumns) {
      for (const col of q.tableColumns) {
        if (col.textReplace) textReplaceCols.add(col.key);
      }
    }
    for (const [colKey, blankIdxList] of Object.entries(mapping)) {
      if (!Array.isArray(blankIdxList)) continue;
      if (textReplaceCols.has(colKey)) continue; // skip — handled by text replacement
      for (let row = 0; row < blankIdxList.length; row++) {
        const blankIdx = blankIdxList[row];
        if (blankIdx == null) continue;
        const rowData = tableData[row];
        let cellVal = rowData
          ? rowData[colKey] !== undefined && rowData[colKey] !== null
            ? String(rowData[colKey])
            : ""
          : "";
        // Auto-numbering support for STT column:
        // If column label is "STT" (or starts with "STT") and no value provided,
        // fill with 1-based row index by default.
        if (!cellVal && columnsByKey[colKey]) {
          const colMeta = columnsByKey[colKey];
          if (
            typeof colMeta.label === "string" &&
            /^stt\b/i.test(colMeta.label.trim())
          ) {
            cellVal = String(row + 1);
          }
        }
        indexedAnswers[String(blankIdx)] = cellVal;
        assignedIndices.add(blankIdx);
      }
    }
  }

  if (hasBlankMapping) {
    // Explicit blank mapping — each question maps to specific blank(s)
    indexedAnswers = {};
    assignedIndices = new Set();
    for (const q of questions) {
      if (q.type === "group") {
        for (const child of q.children || []) {
          if (child.type === "dynamic_table") {
            fillDynamicTable(child, indexedAnswers, assignedIndices, answers);
          } else if (child.type !== "computed") {
            fillQuestion(child, indexedAnswers, assignedIndices, answers);
          }
        }
      } else if (q.type === "dynamic_table") {
        fillDynamicTable(q, indexedAnswers, assignedIndices, answers);
      } else if (q.type !== "computed") {
        fillQuestion(q, indexedAnswers, assignedIndices, answers);
      }
    }
  } else {
    // LEGACY: Sequential flat-key mapping (backward compatibility)
    const flatKeys = [];
    for (const q of questions) {
      if (q.type === "group") {
        for (const child of q.children || []) {
          if (child.type !== "computed" && child.type !== "dynamic_table") {
            flatKeys.push(child.key);
          }
        }
      } else if (q.type !== "computed" && q.type !== "dynamic_table") {
        flatKeys.push(q.key);
      }
    }
    indexedAnswers = {};
    for (let i = 0; i < flatKeys.length; i++) {
      const val = answers[flatKeys[i]];
      indexedAnswers[String(i)] = val !== undefined && val !== null ? val : "";
    }
  }

  // Collect text replacements from columns with textReplace + valueMapping
  // e.g. column "gioi_tinh" has textReplace="Ông/Bà", valueMapping={"Nam":"Ông","Nữ":"Bà"}
  // Each row produces one replacement: { search: "Ông/Bà", replace: "Ông" or "Bà" }
  const textReplacements = [];
  function collectTextReplacements(q) {
    // Radio/select question with textReplace (e.g. "Ông/Bà" → "Ông")
    if (
      (q.type === "radio" || q.type === "select") &&
      q.textReplace &&
      q.valueMapping
    ) {
      const rawVal = answers[q.key];
      if (rawVal != null && rawVal !== "") {
        const mapped = q.valueMapping[String(rawVal)] || String(rawVal);
        textReplacements.push({ search: q.textReplace, replace: mapped });
      }
    }
    // Dynamic table columns with textReplace
    if (q.type === "dynamic_table" && q.tableColumns) {
      const tableData = answers[q.key];
      if (!Array.isArray(tableData)) return;
      for (const row of tableData) {
        for (const col of q.tableColumns) {
          if (!col.textReplace || !col.valueMapping) continue;
          const rawVal = row ? row[col.key] : undefined;
          // If value is empty, keep original text (don't push replacement)
          if (rawVal == null || rawVal === "") {
            textReplacements.push({
              search: col.textReplace,
              replace: col.textReplace,
            });
            continue;
          }
          const mapped = col.valueMapping[String(rawVal)] || String(rawVal);
          textReplacements.push({ search: col.textReplace, replace: mapped });
        }
      }
    }
  }
  for (const q of questions) {
    if (q.type === "group") {
      for (const child of q.children || []) collectTextReplacements(child);
    } else {
      collectTextReplacements(q);
    }
  }

  // Generate document from template (templateFilePath already declared above)
  const generatedFileUrl = await generateDocument(
    templateFilePath,
    template.template_type,
    indexedAnswers,
    assignedIndices,
    dynamicExpansions.length > 0 ? dynamicExpansions : null,
    textReplacements.length > 0 ? textReplacements : null,
  );

  const submission = await DocumentSubmission.create({
    template_id: template.id,
    submitted_by: req.user.id,
    answers,
    generated_file_url: generatedFileUrl,
    status: "completed",
  });

  // PDF nền (không await): không chặn response 201. Khi user vào trang kết quả, /print thường trúng cache → nhanh.
  if (template.template_type === "docx") {
    const docxPath = uploadsAbsPath(generatedFileUrl);
    const diskBase = path.basename(docxPath, ".docx");
    const pdfFilename = `${diskBase}.pdf`;
    const generatedDir = path.join(__dirname, "../../uploads/generated");
    const pdfPath = path.join(generatedDir, pdfFilename);
    setImmediate(() => {
      docxToPdf(docxPath, pdfPath).catch((err) => {
        console.error(
          "[digitization] PDF nền thất bại (Word/COM):",
          err && err.message ? err.message : err,
        );
      });
    });
  }

  const full = await DocumentSubmission.findByPk(submission.id, {
    include: [
      {
        model: DocumentTemplate,
        as: "template",
        attributes: ["name", "template_type"],
      },
    ],
  });
  const displayBase = await getSubmissionDisplayBasename(full);
  const payload = {
    ...full.toJSON(),
    ...attachDisplayFilenames(displayBase, full.template.template_type),
  };

  return successResponse(
    res,
    payload,
    "Document generated successfully",
    201,
  );
});

// GET /api/admin/digitization/submissions
exports.getMySubmissions = asyncHandler(async (req, res) => {
  const { page, limit, offset } = parsePagination(req.query);
  const { template_id } = req.query;

  const where = { submitted_by: req.user.id };
  if (template_id) where.template_id = template_id;

  const { count, rows } = await DocumentSubmission.findAndCountAll({
    where,
    include: [
      {
        model: DocumentTemplate,
        as: "template",
        attributes: ["id", "name", "slug", "template_type", "icon"],
      },
    ],
    order: [["created_at", "DESC"]],
    limit,
    offset,
  });

  const ids = rows.map((r) => r.id);
  const priorMap = await fetchPriorCountsBySubmissionIds(ids);
  const enriched = rows.map((r) => {
    const prior = priorMap.get(r.id) ?? 0;
    const displayBase = displayBasenameFromPrior(r, prior);
    return {
      ...r.toJSON(),
      ...attachDisplayFilenames(displayBase, r.template.template_type),
    };
  });

  return paginatedResponse(res, enriched, count, page, limit);
});

// GET /api/admin/digitization/submissions/:id
exports.getSubmissionById = asyncHandler(async (req, res) => {
  const submission = await DocumentSubmission.findByPk(req.params.id, {
    include: [
      {
        model: DocumentTemplate,
        as: "template",
        attributes: [
          "id",
          "name",
          "slug",
          "template_type",
          "questions",
          "icon",
        ],
      },
    ],
  });

  if (!submission) throw new ApiError(404, "Submission not found");
  if (submission.submitted_by !== req.user.id && req.user.role !== "admin") {
    throw new ApiError(403, "Access denied");
  }

  const displayBase = await getSubmissionDisplayBasename(submission);
  const payload = {
    ...submission.toJSON(),
    ...attachDisplayFilenames(displayBase, submission.template.template_type),
  };

  return successResponse(res, payload);
});

// GET /api/admin/digitization/submissions/:id/download
exports.downloadSubmission = asyncHandler(async (req, res) => {
  const submission = await DocumentSubmission.findByPk(req.params.id, {
    include: [
      {
        model: DocumentTemplate,
        as: "template",
        attributes: ["name", "template_type"],
      },
    ],
  });

  if (!submission) throw new ApiError(404, "Submission not found");
  if (submission.submitted_by !== req.user.id && req.user.role !== "admin") {
    throw new ApiError(403, "Access denied");
  }

  const filePath = uploadsAbsPath(submission.generated_file_url);
  const ext = submission.template.template_type;
  const displayBase = await getSubmissionDisplayBasename(submission);
  const filename = `${displayBase}.${ext}`;

  res.setHeader("Content-Disposition", buildAttachmentContentDisposition(filename));
  res.sendFile(path.resolve(filePath));
});

// GET /api/admin/digitization/submissions/:id/print
// Convert docx -> pdf and serve inline for consistent printing.
exports.printSubmission = asyncHandler(async (req, res) => {
  const submission = await DocumentSubmission.findByPk(req.params.id, {
    include: [
      {
        model: DocumentTemplate,
        as: "template",
        attributes: ["name", "template_type"],
      },
    ],
  });

  if (!submission) throw new ApiError(404, "Submission not found");
  if (submission.submitted_by !== req.user.id && req.user.role !== "admin") {
    throw new ApiError(403, "Access denied");
  }
  if (submission.template.template_type !== "docx") {
    throw new ApiError(400, "Chỉ hỗ trợ In cho Word (docx)");
  }

  const filePath = uploadsAbsPath(submission.generated_file_url);
  if (!submission.generated_file_url || !filePath) {
    throw new ApiError(400, "Submission không có file văn bản đã tạo");
  }
  if (!fs.existsSync(filePath)) {
    throw new ApiError(
      404,
      `Không tìm thấy file DOCX trên máy chủ: ${submission.generated_file_url}`,
    );
  }

  const ext = submission.template.template_type; // 'docx'
  const diskBase = path.basename(filePath, `.${ext}`);
  const pdfFilename = `${diskBase}.pdf`;

  const generatedDir = path.join(__dirname, "../../uploads/generated");
  const pdfPath = path.join(generatedDir, pdfFilename);

  await waitForBackgroundPdfIfAny(pdfPath, filePath);
  await docxToPdf(filePath, pdfPath);

  const displayBase = await getSubmissionDisplayBasename(submission);
  const displayPdfName = `${displayBase}.pdf`;

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", buildInlineContentDisposition(displayPdfName));
  // Trình duyệt có thể cache GET này — lần xem lại / chuyển trang nhanh hơn (cùng submission).
  res.setHeader("Cache-Control", "private, max-age=86400")
  res.sendFile(pdfPath)
})

// DELETE /api/admin/digitization/submissions/:id
exports.deleteSubmission = asyncHandler(async (req, res) => {
  const submission = await DocumentSubmission.findByPk(req.params.id);

  if (!submission) throw new ApiError(404, "Submission not found");
  if (submission.submitted_by !== req.user.id && req.user.role !== "admin") {
    throw new ApiError(403, "Access denied");
  }

  const generatedUrl = submission.generated_file_url;
  const absDocx = generatedUrl ? uploadsAbsPath(generatedUrl) : null;

  await submission.destroy();

  // Xóa file sau khi đã xóa DB — chạy nền để không chặn response ~3s (retry EBUSY trên Windows).
  if (absDocx) {
    setImmediate(() => {
      void (async () => {
        await tryUnlinkGeneratedFile(absDocx);
        if (absDocx.toLowerCase().endsWith(".docx")) {
          const pdfPath = path.join(
            path.dirname(absDocx),
            `${path.basename(absDocx, ".docx")}.pdf`,
          );
          await tryUnlinkGeneratedFile(pdfPath);
        }
      })();
    });
  }

  return successResponse(res, null, "Submission deleted");
});

// ============ ADMIN (CRUD templates) ============

// GET /api/admin/digitization/templates
exports.getAllTemplates = asyncHandler(async (req, res) => {
  const { page, limit, offset } = parsePagination(req.query);
  const { search, category, department_id, company_id } = req.query;

  const where = {};
  if (search) where.name = { [Op.iLike]: `%${search}%` };
  if (category) where.category = category;
  if (department_id) where.department_id = department_id;

  // Handle company_id filter:
  // - "null" means show only templates with company_id IS NULL
  // - specific ID means show templates assigned to that company OR company_id IS NULL (applies to all)
  // - empty/undefined means show all
  if (company_id === "null") {
    where.company_id = null;
  } else if (company_id) {
    where.company_id = {
      [Op.or]: [{ [Op.eq]: parseInt(company_id) }, { [Op.is]: null }],
    };
  }

  const { count, rows } = await DocumentTemplate.findAndCountAll({
    where,
    include: [
      { model: User, as: "creator", attributes: ["id", "full_name"] },
      { model: Department, as: "department", attributes: ["id", "name"] },
    ],
    order: [
      ["sort_order", "ASC"],
      ["created_at", "DESC"],
    ],
    limit,
    offset,
  });

  return paginatedResponse(res, rows, count, page, limit);
});

// POST /api/admin/digitization/templates
exports.createTemplate = asyncHandler(async (req, res) => {
  const {
    name,
    description,
    template_type,
    template_file_url,
    questions,
    blanks,
    category,
    icon,
    sort_order,
    is_active,
    department_id,
    company_id,
  } = req.body;

  const slug = slugify(name);
  const existing = await DocumentTemplate.findOne({ where: { slug } });
  const finalSlug = existing ? `${slug}-${Date.now()}` : slug;

  const template = await DocumentTemplate.create({
    name,
    slug: finalSlug,
    description,
    template_type,
    template_file_url,
    questions,
    blanks: blanks || null,
    category,
    icon: icon || "description",
    sort_order: sort_order || 0,
    is_active: is_active !== undefined ? is_active : true,
    department_id: department_id || null,
    company_id: company_id || null,
    created_by: req.user.id,
  });

  return successResponse(res, template, "Template created", 201);
});

// PUT /api/admin/digitization/templates/:id
exports.updateTemplate = asyncHandler(async (req, res) => {
  const template = await DocumentTemplate.findByPk(req.params.id);
  if (!template) throw new ApiError(404, "Template not found");

  const {
    name,
    description,
    template_type,
    template_file_url,
    questions,
    blanks,
    category,
    icon,
    sort_order,
    is_active,
    department_id,
    company_id,
  } = req.body;

  if (name && name !== template.name) {
    const newSlug = slugify(name);
    const existing = await DocumentTemplate.findOne({
      where: { slug: newSlug, id: { [Op.ne]: template.id } },
    });
    template.slug = existing ? `${newSlug}-${Date.now()}` : newSlug;
    template.name = name;
  }

  if (description !== undefined) template.description = description;
  if (template_type !== undefined) template.template_type = template_type;
  if (
    template_file_url !== undefined &&
    template_file_url !== template.template_file_url
  ) {
    // Delete old template file when replaced
    const oldFilePath = path.join(
      __dirname,
      "../../",
      template.template_file_url,
    );
    try {
      if (fs.existsSync(oldFilePath)) fs.unlinkSync(oldFilePath);
    } catch (e) {
      /* ignore cleanup errors */
    }
    template.template_file_url = template_file_url;
  }
  if (questions !== undefined) template.questions = questions;
  if (blanks !== undefined) template.blanks = blanks;
  if (category !== undefined) template.category = category;
  if (icon !== undefined) template.icon = icon;
  if (sort_order !== undefined) template.sort_order = sort_order;
  if (is_active !== undefined) template.is_active = is_active;
  if (department_id !== undefined) template.department_id = department_id;
  if (company_id !== undefined) template.company_id = company_id;

  await template.save();
  return successResponse(res, template, "Template updated");
});

// DELETE /api/admin/digitization/templates/:id
exports.deleteTemplate = asyncHandler(async (req, res) => {
  const template = await DocumentTemplate.findByPk(req.params.id);
  if (!template) throw new ApiError(404, "Template not found");

  await template.destroy();
  return successResponse(res, null, "Template deleted");
});

// POST /api/admin/digitization/parse-placeholders
// Auto-detect "..." blanks in the document and generate questions
exports.parsePlaceholders = asyncHandler(async (req, res) => {
  const { file_url, template_type } = req.body;
  if (!file_url || !template_type) {
    throw new ApiError(400, "file_url and template_type are required");
  }

  const filePath = uploadsAbsPath(file_url);
  const rawBlanks = await parseBlanks(filePath, template_type);

  // Blanks metadata for admin UI
  const blanksMeta = rawBlanks.map((blank, index) => ({
    index,
    label: blank.label,
    context: blank.context || "",
  }));

  // Convert blanks to questions with explicit blankIndex mapping
  const questions = rawBlanks.map((blank, index) => ({
    key: String(index),
    label: blank.label,
    blankIndex: index,
    type: "text",
    required: true,
    placeholder: "",
    options: [],
  }));

  // Parse blanks grouped by line for preview panel
  let documentLines = [];
  try {
    documentLines = parseBlanksByLine(filePath, template_type);
  } catch {
    // Non-critical: preview is optional
  }

  return successResponse(res, { blanks: blanksMeta, questions, documentLines });
});
