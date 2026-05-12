const fs = require("fs");
const path = require("path");
const PizZip = require("pizzip");
const Docxtemplater = require("docxtemplater");
const ExcelJS = require("exceljs");

const GENERATED_DIR = path.join(__dirname, "../../uploads/generated");

// Decode HTML entities to plain text
function decodeHtmlEntities(str) {
  return str
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) =>
      String.fromCharCode(parseInt(hex, 16)),
    )
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&acirc;/g, "â")
    .replace(/&Acirc;/g, "Â")
    .replace(/&ocirc;/g, "ô")
    .replace(/&Ocirc;/g, "Ô")
    .replace(/&ecirc;/g, "ê")
    .replace(/&Ecirc;/g, "Ê")
    .replace(/&agrave;/g, "à")
    .replace(/&Agrave;/g, "À")
    .replace(/&aacute;/g, "á")
    .replace(/&Aacute;/g, "Á")
    .replace(/&atilde;/g, "ã")
    .replace(/&Atilde;/g, "Ã")
    .replace(/&egrave;/g, "è")
    .replace(/&Egrave;/g, "È")
    .replace(/&eacute;/g, "é")
    .replace(/&Eacute;/g, "É")
    .replace(/&igrave;/g, "ì")
    .replace(/&Igrave;/g, "Ì")
    .replace(/&iacute;/g, "í")
    .replace(/&Iacute;/g, "Í")
    .replace(/&ograve;/g, "ò")
    .replace(/&Ograve;/g, "Ò")
    .replace(/&oacute;/g, "ó")
    .replace(/&Oacute;/g, "Ó")
    .replace(/&otilde;/g, "õ")
    .replace(/&Otilde;/g, "Õ")
    .replace(/&ugrave;/g, "ù")
    .replace(/&Ugrave;/g, "Ù")
    .replace(/&uacute;/g, "ú")
    .replace(/&Uacute;/g, "Ú")
    .replace(/&yacute;/g, "ý")
    .replace(/&Yacute;/g, "Ý")
    .replace(/&uuml;/g, "ü")
    .replace(/&Uuml;/g, "Ü")
    .replace(/&ccedil;/g, "ç")
    .replace(/&Ccedil;/g, "Ç")
    .replace(/&[a-zA-Z]+;/g, ""); // strip any remaining named entities
}

// Escape text for safe insertion into XML
function escapeXml(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

if (!fs.existsSync(GENERATED_DIR)) {
  fs.mkdirSync(GENERATED_DIR, { recursive: true });
}

// ============ DOTS PATTERN ============
// Matches fill-in blanks:
//   [.…]{3,}  → 3+ mixed dots/ellipsis (e.g. ......, …….., ………)
//   …{1,}     → 1+ Unicode ellipsis not already matched above (e.g. single … or ……)
const DOTS_RAW = /[.…]{3,}|…+/g;

/**
 * Classify a dots match.
 * Returns: 'blank' (real fill-in), 'continuation' (dots-only line following a blank), or 'skip'
 */
function classifyDots(fullText, matchIndex, matchLength, ctx = {}) {
  const lineStart = fullText.lastIndexOf("\n", matchIndex - 1) + 1;
  const lineEnd = fullText.indexOf("\n", matchIndex + matchLength);
  const line = fullText.substring(
    lineStart,
    lineEnd === -1 ? fullText.length : lineEnd,
  );

  // Line is ONLY dots/spaces/punctuation → continuation or separator (or table cell)
  const stripped = line.replace(/[.\s…,\-–—_*=~()\t]+/g, "");
  if (stripped.length < 2) {
    // In DOCX tables, each cell can look like a dots-only "line". Treat as separate blanks
    // to avoid collapsing the whole table row into a single blank.
    if (ctx.inTable) return "blank";

    // Check: if previous line is a heading/label (has real text, not dots-only),
    // then this dots-only line is a NEW blank, not a continuation.
    const prevLineEnd = lineStart - 1; // position of \n before this line
    if (prevLineEnd > 0) {
      const prevLineStart = fullText.lastIndexOf("\n", prevLineEnd - 1) + 1;
      const prevLine = fullText.substring(prevLineStart, prevLineEnd);
      const prevStripped = prevLine.replace(/[.\s…,\-–—_*=~()\t]+/g, "");
      const prevHasDots = /[.…]{3,}|…+/.test(prevLine);
      // Previous line has real text and NO dots → this is a new blank under a heading
      if (prevStripped.length >= 2 && !prevHasDots) {
        return "blank";
      }

      // Special case: table rows with multiple dot-only cells.
      // Pattern (flattened text):
      //   [header line with text]
      //   dots-only
      //   dots-only
      //   ...
      //
      // The first dots-only line is already handled above (prev line = header).
      // For the NEXT dots-only lines in the same row, previous line is dots-only,
      // but we still want them to be separate blanks. We look one more line up;
      // if that line looks like a header (real text, no dots), treat current as blank.
      if (prevStripped.length < 2) {
        const prev2LineEnd = prevLineStart - 1;
        if (prev2LineEnd > 0) {
          const prev2LineStart =
            fullText.lastIndexOf("\n", prev2LineEnd - 1) + 1;
          const prev2Line = fullText.substring(prev2LineStart, prev2LineEnd);
          const prev2Stripped = prev2Line.replace(/[.\s…,\-–—_*=~()\t]+/g, "");
          const prev2HasDots = /[.…]{3,}|…+/.test(prev2Line);
          if (prev2Stripped.length >= 2 && !prev2HasDots) {
            return "blank";
          }
        }
      }

      // Another table pattern: a row starts with a short index ("1", "2", "3"),
      // then multiple dot-only cells follow. When we're on the 2nd/3rd dot-only cell,
      // the previous line is dots-only and the "header" isn't immediately above.
      // If we can find a digits-only line when scanning upward, treat as a new blank.
      // This avoids collapsing multiple table cells into one blank, while not affecting
      // normal multi-line continuations (which typically don't have a digits-only marker).
      if (prevStripped.length < 2) {
        let scanEnd = prevLineStart - 1;
        let scanned = 0;
        while (scanEnd > 0 && scanned < 8) {
          const scanStart = fullText.lastIndexOf("\n", scanEnd - 1) + 1;
          const scanLine = fullText.substring(scanStart, scanEnd);
          const scanStripped = scanLine.replace(/[.\s…,\-–—_*=~()\t]+/g, "");
          const scanHasDots = /[.…]{3,}|…+/.test(scanLine);
          // Digits-only marker (e.g. table STT cell "1", "2", "3")
          if (!scanHasDots && /^\d{1,3}$/.test(scanStripped.trim())) {
            return "blank";
          }
          // Stop if we hit a real text line (non dots-only, non digits-only)
          if (!scanHasDots && scanStripped.trim().length >= 2) break;
          scanEnd = scanStart - 1;
          scanned++;
        }
      }
    }
    return "continuation";
  }

  const charBefore = matchIndex > 0 ? fullText[matchIndex - 1] : "\n";

  // Short dots (≤4 chars or single …) glued to a LETTER → ellipsis, skip
  // But allow dots after digits (e.g. "202..." = year blank)
  // and after punctuation like : ; ,
  const matched = fullText.substring(matchIndex, matchIndex + matchLength);
  const isShort = matched.length <= 4 || matched === "…";
  if (isShort) {
    if (/[a-zA-Z\u00C0-\u024F\u1E00-\u1EFF]/.test(charBefore)) return "skip";
  }

  return "blank";
}

// ============ PARSE: Find blanks (dots) in docx ============

function computeTableIntervals(xmlContent) {
  const tagRegex = /<\/?w:tbl\b[^>]*>/g;
  const stack = [];
  const intervals = [];
  let m;
  while ((m = tagRegex.exec(xmlContent)) !== null) {
    const tag = m[0];
    if (tag.startsWith("</")) {
      const start = stack.pop();
      if (start != null) intervals.push({ start, end: m.index + tag.length });
    } else {
      stack.push(m.index);
    }
  }
  intervals.sort((a, b) => a.start - b.start);
  return intervals;
}

function isXmlPosInTable(xmlPos, tableIntervals) {
  if (!tableIntervals || tableIntervals.length === 0) return false;
  let lo = 0;
  let hi = tableIntervals.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const it = tableIntervals[mid];
    if (xmlPos < it.start) hi = mid - 1;
    else if (xmlPos >= it.end) lo = mid + 1;
    else return true;
  }
  return false;
}

function extractDocxTextWithLineContext(templatePath) {
  const absolutePath = path.resolve(templatePath);
  const content = fs.readFileSync(absolutePath, "binary");
  const zip = new PizZip(content);

  const xmlContent = zip.file("word/document.xml")?.asText();
  if (!xmlContent) return { fullText: "", lineStarts: [], lineInTable: [] };

  const tableIntervals = computeTableIntervals(xmlContent);
  const paraRegex = /<w:p[ >][\s\S]*?<\/w:p>/g;

  const lines = [];
  const lineInTable = [];
  let pm;
  while ((pm = paraRegex.exec(xmlContent)) !== null) {
    const paraXml = pm[0];
    let lineText = "";
    const withTabs = paraXml.replace(/<w:tab\/>/g, "\x00TAB\x00");
    const textMatches = withTabs.match(/<w:t[^>]*>([^<]*)<\/w:t>/g) || [];
    for (const tm of textMatches) lineText += tm.replace(/<[^>]+>/g, "");
    lineText = lineText.replace(/\x00TAB\x00/g, "\t");
    lines.push(lineText);
    lineInTable.push(isXmlPosInTable(pm.index, tableIntervals));
  }

  const lineStarts = [];
  let pos = 0;
  for (let i = 0; i < lines.length; i++) {
    lineStarts.push(pos);
    pos += lines[i].length + 1; // +1 for \n
  }
  return { fullText: lines.join("\n"), lineStarts, lineInTable };
}

function extractDocxFullText(templatePath) {
  return extractDocxTextWithLineContext(templatePath).fullText;
}

/**
 * Parse a docx and find all blanks (dots patterns like ........)
 * Returns array of { label, index } where label is the context text before the dots
 */
function parseDocxBlanks(templatePath) {
  const { fullText, lineStarts, lineInTable } =
    extractDocxTextWithLineContext(templatePath);
  const blanks = [];
  let match;
  const regex = new RegExp(DOTS_RAW.source, "g");
  let index = 0;

  while ((match = regex.exec(fullText)) !== null) {
    // Resolve which line this match is on, to get inTable context
    let inTable = false;
    if (lineStarts && lineStarts.length > 0) {
      let lo = 0;
      let hi = lineStarts.length - 1;
      let lineIdx = 0;
      while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        if (lineStarts[mid] <= match.index) {
          lineIdx = mid;
          lo = mid + 1;
        } else {
          hi = mid - 1;
        }
      }
      inTable = !!lineInTable?.[lineIdx];
    }

    const cls = classifyDots(fullText, match.index, match[0].length, {
      inTable,
    });

    if (cls === "skip") continue;

    if (cls === "continuation") {
      // Attach to previous blank if exists
      if (blanks.length > 0) {
        const prev = blanks[blanks.length - 1];
        prev.continuationDots.push({
          start: match.index,
          end: match.index + match[0].length,
        });
      }
      continue;
    }

    // cls === 'blank'
    // Get label: text immediately before this dots match
    // Use the nearest boundary: line start, or end of previous dots on same line
    const lineStart = fullText.lastIndexOf("\n", match.index - 1) + 1;
    const beforeOnLine = fullText.substring(lineStart, match.index);

    // Find the LAST dots pattern in before-text to get only the nearest text segment
    const dotsInBefore = new RegExp(DOTS_RAW.source, "g");
    let lastDotsEnd = -1;
    let dm2;
    while ((dm2 = dotsInBefore.exec(beforeOnLine)) !== null) {
      lastDotsEnd = dm2.index + dm2[0].length;
    }

    let nearestText;
    if (lastDotsEnd >= 0) {
      nearestText = beforeOnLine.substring(lastDotsEnd);
    } else {
      nearestText = beforeOnLine;
    }

    let rawLabel = nearestText
      .replace(/\d+$/, "") // trim trailing digits glued to dots (e.g. "năm 202" → "năm ")
      .replace(/[:\.\s…,/'\u2018\u2019\u201C\u201D\-–—]+$/, "") // trim trailing punctuation
      .replace(/^\d+[\.\)]\s*/, "") // trim leading "1." or "1)"
      .replace(/^[:\.\s…,/'\u2018\u2019\u201C\u201D\-–—)]+/, "") // trim leading punctuation
      .trim();

    // If this blank had a previous dots match on the same line,
    // nearestText may start with a unit marker for the previous blank.
    // Strip leading unit markers: ' (minute mark), h (hour), % (percent)
    // followed by optional unit word like "phút", "người", etc.
    let label = rawLabel;
    if (lastDotsEnd >= 0 && rawLabel.length > 0) {
      const betweenRaw = nearestText.trimStart();
      // Pattern: optional unit marker char + optional unit word + space + actual label
      const unitStripPattern =
        /^(?:['\u2018\u2019h%]\s*)?(?:phút|giờ|người)\s+/i;
      if (unitStripPattern.test(betweenRaw)) {
        const stripped = betweenRaw.replace(unitStripPattern, "");
        label = stripped
          .replace(/\d+$/, "")
          .replace(/[:\.\s…,/'\u2018\u2019\u201C\u201D\-–—]+$/, "")
          .replace(/^\d+[\.\)]\s*/, "")
          .replace(/^[:\.\s…,/'\u2018\u2019\u201C\u201D\-–—)]+/, "")
          .trim();
      }
    }

    // Special: digits glued before dots (e.g. "202...", "20…") → year/number pattern
    if (label.length < 2) {
      const digitsBefore = nearestText.match(/(\d{2,4})\s*$/);
      if (digitsBefore) {
        const digits = digitsBefore[1];
        // "202" or "20" → year
        if (digits.startsWith("20") || digits.startsWith("19")) {
          label = "Năm";
        } else {
          label = "Số";
        }
      }
    }

    // If label is too short, try text AFTER the dots on the same line
    if (label.length < 2) {
      const lineEnd = fullText.indexOf("\n", match.index + match[0].length);
      const afterOnLine = fullText.substring(
        match.index + match[0].length,
        lineEnd === -1 ? fullText.length : lineEnd,
      );

      // Special: Vietnamese date pattern "..., ngày … tháng … năm ..."
      // If after-text starts with ", ngày" → this blank is Địa điểm (location)
      if (/^[,\s]*,?\s*ngày\b/i.test(afterOnLine)) {
        label = "Địa điểm";
      } else {
        // Take only the first meaningful word(s) before next dots or end of segment
        const nextDotsPos = afterOnLine.search(/[.…]{3,}|…+/);
        const afterSegment =
          nextDotsPos >= 0
            ? afterOnLine.substring(0, nextDotsPos)
            : afterOnLine;
        const afterLabel = afterSegment
          .replace(/^[:\.\s…,/'\u2018\u2019\u201C\u201D\-–—)]+/, "")
          .replace(/[:\.\s…,/'\u2018\u2019\u201C\u201D\-–—]+$/, "")
          .trim();
        // If afterLabel has multiple words separated by dots-context, take only first meaningful word
        const firstWord = afterLabel.split(/\s+/)[0];
        if (afterLabel.length >= 2) {
          // Use just the first word if the segment looks like "phút ngày" (multi-blank context)
          label =
            firstWord.length >= 2 && nextDotsPos >= 0 ? firstWord : afterLabel;
        }
      }
    }

    // For numbered lines (1.... X: ....%), if the first blank has a vague label,
    // derive a better label from line context (e.g. "Tên" for name blank before "Sở hữu")
    if (label.length < 2 || label === "Sở") {
      const lineEnd2 = fullText.indexOf("\n", match.index + match[0].length);
      const fullLine = fullText.substring(
        lineStart,
        lineEnd2 === -1 ? fullText.length : lineEnd2,
      );
      // Check if line starts with a number and has another keyword after dots
      if (/^\s*\d+[\.\)]/.test(fullLine)) {
        // This is a numbered list line — first blank is usually "Tên/Họ tên"
        // Look for a keyword after subsequent dots: "Sở hữu", "cổ phần", etc.
        const keywordMatch = fullLine.match(
          /(?:Sở hữu|cổ phần|chức vụ|địa chỉ)/i,
        );
        if (keywordMatch && label.length < 4) {
          label = "Họ tên";
        }
      }
    }

    // For dots-only lines classified as 'blank' (e.g. after a heading like "III. KẾT LUẬN"),
    // use the previous line's text as the label
    if (label.length < 2) {
      const currentLine = fullText.substring(
        lineStart,
        fullText.indexOf("\n", match.index + match[0].length) === -1
          ? fullText.length
          : fullText.indexOf("\n", match.index + match[0].length),
      );
      const currentStripped = currentLine.replace(/[.\s…,\-–—_*=~()\t]+/g, "");
      if (currentStripped.length < 2) {
        // This is a dots-only line — derive label from previous line
        const prevLineEnd = lineStart - 1;
        if (prevLineEnd > 0) {
          const prevLineStart = fullText.lastIndexOf("\n", prevLineEnd - 1) + 1;
          const prevLine = fullText.substring(prevLineStart, prevLineEnd);
          const prevLabel = prevLine
            .replace(/^[IVXivx\d]+[\.\)]\s*/, "") // trim leading roman/arabic numbering
            .replace(/[:\.\s…,\-–—_*=~()\t]+$/, "") // trim trailing punctuation
            .trim();
          if (prevLabel.length >= 2) {
            label = prevLabel;
          }
        }
      }
    }

    if (label.length < 2) {
      label = `Trường ${index + 1}`;
    }

    // Build context snippet: text around the dots on the same line
    const ctxLineStart = fullText.lastIndexOf("\n", match.index - 1) + 1;
    const ctxLineEnd = fullText.indexOf("\n", match.index + match[0].length);
    const ctxLine = fullText
      .substring(ctxLineStart, ctxLineEnd === -1 ? fullText.length : ctxLineEnd)
      .trim();
    // For dots-only lines, include previous line in context for better readability
    const currentLineText = fullText.substring(
      ctxLineStart,
      ctxLineEnd === -1 ? fullText.length : ctxLineEnd,
    );
    const currentLineStripped = currentLineText.replace(
      /[.\s…,\-–—_*=~()\t]+/g,
      "",
    );
    let ctxPrefix = "";
    if (currentLineStripped.length < 2 && ctxLineStart > 0) {
      const prevEnd = ctxLineStart - 1;
      const prevStart = fullText.lastIndexOf("\n", prevEnd - 1) + 1;
      ctxPrefix = fullText.substring(prevStart, prevEnd).trim() + " ";
    }
    // Replace the CURRENT dots with [___] placeholder, keep other dots
    const ctxBefore = fullText.substring(ctxLineStart, match.index);
    const ctxAfter = fullText.substring(
      match.index + match[0].length,
      ctxLineEnd === -1 ? fullText.length : ctxLineEnd,
    );
    // Trim context to ~80 chars on each side
    const maxCtx = 80;
    const trimBefore =
      ctxBefore.length > maxCtx
        ? "..." + ctxBefore.substring(ctxBefore.length - maxCtx)
        : ctxBefore;
    const trimAfter =
      ctxAfter.length > maxCtx
        ? ctxAfter.substring(0, maxCtx) + "..."
        : ctxAfter;
    const context = (ctxPrefix + trimBefore + "[___]" + trimAfter).trim();

    // Detect if this blank is on a dots-only line (created from heading + dots pattern)
    const blankLineText = fullText.substring(
      lineStart,
      fullText.indexOf("\n", match.index + match[0].length) === -1
        ? fullText.length
        : fullText.indexOf("\n", match.index + match[0].length),
    );
    const isDotsOnlyBlank =
      blankLineText.replace(/[.\s…,\-–—_*=~()\t]+/g, "").length < 2;

    blanks.push({
      label,
      context,
      dotsStart: match.index,
      dotsEnd: match.index + match[0].length,
      dotsLength: match[0].length,
      continuationDots: [],
      _isDotsOnlyBlank: isDotsOnlyBlank,
    });
    index++;
  }

  // Post-process: blanks with continuation dots get an extra question for the continuation content.
  // This handles patterns like "Ý kiến (Ông/Bà):......\n......\n......" where line 1 = name,
  // continuation lines = opinion/content that needs its own input field.
  // Exception: dots-only blanks (after headings like "KẾT LUẬN") merge continuations into
  // themselves instead of creating a separate entry — multiple dots lines = 1 input field.
  const expanded = [];
  for (const blank of blanks) {
    if (blank._isDotsOnlyBlank && blank.continuationDots.length > 0) {
      // Merge: extend this blank to cover all continuation ranges
      const contEnd =
        blank.continuationDots[blank.continuationDots.length - 1].end;
      blank.dotsEnd = contEnd;
      blank.dotsLength = contEnd - blank.dotsStart;
      // Keep continuation ranges for generate to clear them, but don't create a separate blank
      expanded.push(blank);
      continue;
    }
    expanded.push(blank);
    if (blank.continuationDots.length > 0) {
      // Create a second blank for the continuation content
      const contStart = blank.continuationDots[0].start;
      const contEnd =
        blank.continuationDots[blank.continuationDots.length - 1].end;
      expanded.push({
        label: `Nội dung ${blank.label}`,
        context: blank.context,
        dotsStart: contStart,
        dotsEnd: contEnd,
        dotsLength: contEnd - contStart,
        continuationDots: [],
        // Mark this as a continuation blank so generate knows to replace all continuation dots
        _isContinuationBlank: true,
        _allContinuationRanges: blank.continuationDots,
      });
      // Clear the original blank's continuation (it no longer owns them)
      blank.continuationDots = [];
    }
  }

  return expanded;
}

/**
 * Parse an xlsx and find all blanks
 */
async function parseXlsxBlanks(templatePath) {
  const absolutePath = path.resolve(templatePath);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(absolutePath);

  const blanks = [];
  const regex = new RegExp(DOTS_RAW.source, "g");

  workbook.eachSheet((sheet) => {
    sheet.eachRow((row) => {
      row.eachCell((cell) => {
        if (typeof cell.value === "string") {
          let match;
          while ((match = regex.exec(cell.value)) !== null) {
            if (
              classifyDots(cell.value, match.index, match[0].length) !== "blank"
            )
              continue;

            const before = cell.value.substring(0, match.index);
            let label = before.replace(/[:\.\s]+$/, "").trim();
            if (label.length < 2) label = `Trường ${blanks.length + 1}`;

            blanks.push({
              label,
              cellAddress: cell.address,
              dotsStart: match.index,
              dotsEnd: match.index + match[0].length,
              continuationDots: [],
            });
          }
        }
      });
    });
  });

  return blanks;
}

/**
 * Parse blanks from template (auto-detect type)
 */
async function parseBlanks(templatePath, templateType) {
  if (templateType === "docx") {
    return parseDocxBlanks(templatePath);
  } else if (templateType === "xlsx") {
    return parseXlsxBlanks(templatePath);
  }
  throw new Error(`Unsupported template type: ${templateType}`);
}

// ============ GENERATE: Fill blanks with answers ============

/**
 * Preprocess answers: convert non-string values to plain text for document insertion.
 * - textarea (HTML): strip tags → plain text
 * - table (array of objects): convert to "col1: val, col2: val\n..." text
 * - everything else: toString()
 */
function preprocessAnswers(answers) {
  const result = {};
  for (const [key, val] of Object.entries(answers)) {
    if (val == null || val === "") {
      result[key] = "";
      continue;
    }
    if (Array.isArray(val)) {
      // Table answer: array of row objects → plain text lines
      const lines = val.map((row) => {
        if (typeof row === "object" && row !== null) {
          return Object.values(row).join(", ");
        }
        return String(row);
      });
      result[key] = lines.join("; ");
    } else if (typeof val === "string" && /<[^>]+>/.test(val)) {
      // HTML content (textarea rich-text): convert block tags to newlines, strip rest
      let processed = val
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/<\/p>\s*<p[^>]*>/gi, "\n")
        .replace(/<\/div>\s*<div[^>]*>/gi, "\n")
        .replace(/<\/li>/gi, "\n")
        .replace(/<[^>]+>/g, "");
      result[key] = decodeHtmlEntities(processed).trim();
    } else {
      result[key] = String(val);
    }
  }
  return result;
}

/**
 * Expand dynamic table rows in docx XML.
 * If a dynamic_table needs more rows than the template has, clone the last
 * template paragraph for each extra row (updating row numbering).
 *
 * @param {string} xmlContent - raw document.xml content
 * @param {Array} expansions - [{ startBlank, blanksPerRow, templateRows, extraRows }]
 * @returns {string} modified xmlContent with extra paragraphs inserted
 */
function expandDynamicRows(xmlContent, expansions) {
  if (!expansions || expansions.length === 0) return xmlContent;

  const tableIntervals = computeTableIntervals(xmlContent);

  // Extract paragraphs from XML: find each <w:p ...>...</w:p>
  const paraRegex = /<w:p[ >\/][\s\S]*?<\/w:p>/g;
  const paragraphs = []; // { start, end, xml, text }
  let pm;
  while ((pm = paraRegex.exec(xmlContent)) !== null) {
    const wtRegex = /<w:t[^>]*>([^<]*)<\/w:t>/g;
    let text = "";
    let wm;
    while ((wm = wtRegex.exec(pm[0])) !== null) {
      text += wm[1];
    }
    paragraphs.push({
      start: pm.index,
      end: pm.index + pm[0].length,
      xml: pm[0],
      text,
      inTable: isXmlPosInTable(pm.index, tableIntervals),
    });
  }

  // Build text-position mapping for each paragraph
  let runningPos = 0;
  for (const para of paragraphs) {
    para.textStart = runningPos;
    para.textEnd = runningPos + para.text.length;
    runningPos += para.text.length + 1; // +1 for \n separator
  }
  const fullText = paragraphs.map((p) => p.text).join("\n");

  const rowRegex = /<w:tr\b[\s\S]*?<\/w:tr>/g;
  const tableRows = [];
  let rm;
  while ((rm = rowRegex.exec(xmlContent)) !== null) {
    const rowStart = rm.index;
    const rowEnd = rm.index + rm[0].length;
    const paraIndices = [];
    for (let i = 0; i < paragraphs.length; i++) {
      const para = paragraphs[i];
      if (para.start >= rowStart && para.end <= rowEnd) paraIndices.push(i);
    }
    const firstPara =
      paraIndices.length > 0 ? paragraphs[paraIndices[0]] : null;
    const lastPara =
      paraIndices.length > 0
        ? paragraphs[paraIndices[paraIndices.length - 1]]
        : null;
    tableRows.push({
      start: rowStart,
      end: rowEnd,
      xml: rm[0],
      paraIndices,
      tableIndex: tableIntervals.findIndex(
        (it) => rowStart >= it.start && rowEnd <= it.end,
      ),
      textStart: firstPara ? firstPara.textStart : -1,
      textEnd: lastPara ? lastPara.textEnd : -1,
    });
  }

  // Find all blanks in fullText (same classification logic as parseDocxBlanks)
  const dotsRegex = new RegExp(DOTS_RAW.source, "g");
  const allBlanks = []; // { start, end }
  let dm;
  while ((dm = dotsRegex.exec(fullText)) !== null) {
    let inTable = false;
    for (let i = 0; i < paragraphs.length; i++) {
      const para = paragraphs[i];
      if (dm.index >= para.textStart && dm.index < para.textEnd + 1) {
        inTable = !!para.inTable;
        break;
      }
    }
    const cls = classifyDots(fullText, dm.index, dm[0].length, { inTable });
    if (cls === "skip") continue;
    if (cls === "continuation") {
      if (allBlanks.length > 0) {
        const prev = allBlanks[allBlanks.length - 1];
        if (!prev._continuations) prev._continuations = [];
        prev._continuations.push({
          start: dm.index,
          end: dm.index + dm[0].length,
        });
      }
      continue;
    }
    // Detect if this blank is on a dots-only line (same as parseDocxBlanks)
    const blLineStart = fullText.lastIndexOf("\n", dm.index - 1) + 1;
    const blLineEnd = fullText.indexOf("\n", dm.index + dm[0].length);
    const blLineText = fullText.substring(
      blLineStart,
      blLineEnd === -1 ? fullText.length : blLineEnd,
    );
    const isDotsOnly =
      blLineText.replace(/[.\s…,\-–—_*=~()\t]+/g, "").length < 2;
    allBlanks.push({
      start: dm.index,
      end: dm.index + dm[0].length,
      _isDotsOnly: isDotsOnly,
    });
  }

  // Expand continuations into separate entries (matching parseDocxBlanks exactly)
  // - Dots-only blanks: MERGE continuations (extend range, no separate entry)
  // - Normal blanks: CREATE separate entry for continuation content
  const expandedBlanks = [];
  for (const b of allBlanks) {
    if (b._isDotsOnly && b._continuations) {
      // Merge: extend this blank to cover all continuations
      const contEnd = b._continuations[b._continuations.length - 1].end;
      b.end = contEnd;
      delete b._continuations;
      delete b._isDotsOnly;
      expandedBlanks.push(b);
    } else {
      delete b._isDotsOnly;
      expandedBlanks.push(b);
      if (b._continuations) {
        expandedBlanks.push({
          start: b._continuations[0].start,
          end: b._continuations[b._continuations.length - 1].end,
        });
        delete b._continuations;
      }
    }
  }

  // Process expansions in REVERSE document order to preserve XML positions
  const sorted = [...expansions].sort((a, b) => b.startBlank - a.startBlank);

  for (const exp of sorted) {
    const { startBlank, blanksPerRow, templateRows, extraRows } = exp;
    if (extraRows === 0) continue;

    const findTableRowIndexForBlank = (blank) => {
      for (let i = 0; i < tableRows.length; i++) {
        const row = tableRows[i];
        if (row.textStart < 0) continue;
        if (blank.start >= row.textStart && blank.start <= row.textEnd + 1) {
          return i;
        }
      }
      return -1;
    };

    const getTableRowIndicesForTemplateRow = (rowIdx) => {
      const rowIndices = new Set();
      for (let col = 0; col < blanksPerRow; col++) {
        const blankIdx = startBlank + rowIdx * blanksPerRow + col;
        if (blankIdx >= expandedBlanks.length) continue;
        const tableRowIdx = findTableRowIndexForBlank(expandedBlanks[blankIdx]);
        if (tableRowIdx >= 0) rowIndices.add(tableRowIdx);
      }
      return [...rowIndices].sort((a, b) => a - b);
    };

    const startTableRowIdx =
      startBlank >= 0 && startBlank < expandedBlanks.length
        ? findTableRowIndexForBlank(expandedBlanks[startBlank])
        : -1;
    const hasContiguousTableBlock =
      startTableRowIdx >= 0 &&
      startTableRowIdx + templateRows - 1 < tableRows.length &&
      tableRows
        .slice(startTableRowIdx, startTableRowIdx + templateRows)
        .every(
          (row) => row.tableIndex === tableRows[startTableRowIdx].tableIndex,
        );

    if (extraRows < 0) {
      // SHRINK: remove unused template rows from the end
      const rowsToRemove = Math.abs(extraRows);
      if (hasContiguousTableBlock) {
        const actualRows = templateRows + extraRows;
        for (let rowIdx = templateRows - 1; rowIdx >= actualRows; rowIdx--) {
          const row = tableRows[startTableRowIdx + rowIdx];
          xmlContent =
            xmlContent.slice(0, row.start) + xmlContent.slice(row.end);
        }
        continue;
      }
      const tableRowsToRemove = new Set();
      const parasToRemove = new Set();
      for (let r = 0; r < rowsToRemove; r++) {
        const rowIdx = templateRows - 1 - r;
        const matchedTableRows = getTableRowIndicesForTemplateRow(rowIdx);
        if (matchedTableRows.length > 0) {
          for (const tableRowIdx of matchedTableRows) {
            tableRowsToRemove.add(tableRowIdx);
          }
          continue;
        }
        // Find ALL paragraphs containing any blank in this row
        for (let col = 0; col < blanksPerRow; col++) {
          const blankIdx = startBlank + rowIdx * blanksPerRow + col;
          if (blankIdx >= expandedBlanks.length) continue;
          const blank = expandedBlanks[blankIdx];
          // Find paragraph for this blank's main dots
          for (let i = 0; i < paragraphs.length; i++) {
            if (
              blank.start >= paragraphs[i].textStart &&
              blank.start < paragraphs[i].textEnd + 1
            ) {
              parasToRemove.add(i);
              break;
            }
          }
          // Also find paragraphs for continuation dots (if end extends beyond main)
          if (blank.end > blank.start) {
            for (let i = 0; i < paragraphs.length; i++) {
              if (
                blank.end > paragraphs[i].textStart &&
                blank.start <= paragraphs[i].textEnd
              ) {
                parasToRemove.add(i);
              }
            }
          }
        }
      }
      if (tableRowsToRemove.size > 0) {
        const sortedTableRows = [...tableRowsToRemove].sort((a, b) => b - a);
        for (const tableRowIdx of sortedTableRows) {
          const row = tableRows[tableRowIdx];
          xmlContent =
            xmlContent.slice(0, row.start) + xmlContent.slice(row.end);
        }
        continue;
      }
      // Remove paragraphs in reverse order to preserve positions
      const sortedParas = [...parasToRemove].sort((a, b) => b - a);
      for (const paraIdx of sortedParas) {
        const para = paragraphs[paraIdx];
        xmlContent =
          xmlContent.slice(0, para.start) + xmlContent.slice(para.end);
      }
      continue;
    }

    if (hasContiguousTableBlock) {
      const sourceRow = tableRows[startTableRowIdx + templateRows - 1];
      let insertXml = "";
      for (let r = 0; r < extraRows; r++) {
        let clonedXml = sourceRow.xml;

        const oldNum = templateRows;
        const newNum = templateRows + r + 1;
        let numReplaced = false;
        clonedXml = clonedXml.replace(/<w:t[^>]*>[^<]*<\/w:t>/g, (tag) => {
          if (numReplaced) return tag;
          const textMatch = tag.match(/<w:t([^>]*)>([^<]*)<\/w:t>/);
          if (!textMatch) return tag;
          const attrs = textMatch[1];
          const text = textMatch[2];
          const subNumPattern = new RegExp(
            `([\\.\\d]*\\.)(${oldNum})([.\\)\\s])`,
            "",
          );
          if (subNumPattern.test(text)) {
            const newText = text.replace(subNumPattern, `$1${newNum}$3`);
            numReplaced = true;
            return `<w:t${attrs}>${newText}</w:t>`;
          }
          const simpleNumPattern = new RegExp(`(^|\\s)(${oldNum})([.\\)])`, "");
          if (simpleNumPattern.test(text)) {
            const newText = text.replace(simpleNumPattern, `$1${newNum}$3`);
            numReplaced = true;
            return `<w:t${attrs}>${newText}</w:t>`;
          }
          return tag;
        });

        insertXml += clonedXml;
      }

      xmlContent =
        xmlContent.slice(0, sourceRow.end) +
        insertXml +
        xmlContent.slice(sourceRow.end);
      continue;
    }

    const matchedLastTableRows = getTableRowIndicesForTemplateRow(
      templateRows - 1,
    );
    if (matchedLastTableRows.length > 0) {
      const sourceRow = tableRows[matchedLastTableRows[0]];
      let insertXml = "";
      for (let r = 0; r < extraRows; r++) {
        let clonedXml = sourceRow.xml;

        const oldNum = templateRows;
        const newNum = templateRows + r + 1;
        let numReplaced = false;
        clonedXml = clonedXml.replace(/<w:t[^>]*>[^<]*<\/w:t>/g, (tag) => {
          if (numReplaced) return tag;
          const textMatch = tag.match(/<w:t([^>]*)>([^<]*)<\/w:t>/);
          if (!textMatch) return tag;
          const attrs = textMatch[1];
          const text = textMatch[2];
          const subNumPattern = new RegExp(
            `([\\.\\d]*\\.)(${oldNum})([.\\)\\s])`,
            "",
          );
          if (subNumPattern.test(text)) {
            const newText = text.replace(subNumPattern, `$1${newNum}$3`);
            numReplaced = true;
            return `<w:t${attrs}>${newText}</w:t>`;
          }
          const simpleNumPattern = new RegExp(`(^|\\s)(${oldNum})([.\\)])`, "");
          if (simpleNumPattern.test(text)) {
            const newText = text.replace(simpleNumPattern, `$1${newNum}$3`);
            numReplaced = true;
            return `<w:t${attrs}>${newText}</w:t>`;
          }
          return tag;
        });

        insertXml += clonedXml;
      }

      xmlContent =
        xmlContent.slice(0, sourceRow.end) +
        insertXml +
        xmlContent.slice(sourceRow.end);
      continue;
    }

    // EXPAND: clone ALL paragraphs of the last template row
    // A "row" may span multiple paragraphs (e.g. "1.1. Ý kiến:...\n...\n...")
    // Find all paragraphs containing any blank of the last row
    const lastRowParaIndices = new Set();
    for (let col = 0; col < blanksPerRow; col++) {
      const blankIdx = startBlank + (templateRows - 1) * blanksPerRow + col;
      if (blankIdx >= expandedBlanks.length) continue;
      const blank = expandedBlanks[blankIdx];
      for (let i = 0; i < paragraphs.length; i++) {
        // Check if paragraph overlaps with this blank's range
        if (
          blank.start >= paragraphs[i].textStart &&
          blank.start < paragraphs[i].textEnd + 1
        ) {
          lastRowParaIndices.add(i);
        }
        // Also include paragraphs covered by continuation range (end > start means merged)
        if (
          blank.end > blank.start &&
          blank.end > paragraphs[i].textStart &&
          blank.start <= paragraphs[i].textEnd
        ) {
          lastRowParaIndices.add(i);
        }
      }
    }
    if (lastRowParaIndices.size === 0) continue;

    const sortedRowParas = [...lastRowParaIndices].sort((a, b) => a - b);
    const firstParaIdx = sortedRowParas[0];
    const lastParaIdx = sortedRowParas[sortedRowParas.length - 1];
    // Include all paragraphs between first and last (they may be continuation-only dots lines)
    const rowParas = [];
    for (let i = firstParaIdx; i <= lastParaIdx; i++) {
      rowParas.push(paragraphs[i]);
    }

    const lastPara = rowParas[rowParas.length - 1];
    const templateRowXml = rowParas.map((p) => p.xml).join("");

    // Build cloned paragraphs
    let insertXml = "";
    for (let r = 0; r < extraRows; r++) {
      let clonedXml = templateRowXml;

      // Update row number in <w:t> tags
      // Word often splits "2.3." across tags: ["2", ".3. ", "Ý", " kiến:..."]
      // So we need to handle: ".N." or ".N)" in a single tag (sub-numbering split),
      // as well as "N." or "N)" at start-of-tag (simple numbering)
      const oldNum = templateRows;
      const newNum = templateRows + r + 1;
      let numReplaced = false;
      clonedXml = clonedXml.replace(/<w:t[^>]*>[^<]*<\/w:t>/g, (tag) => {
        if (numReplaced) return tag;
        const textMatch = tag.match(/<w:t([^>]*)>([^<]*)<\/w:t>/);
        if (!textMatch) return tag;
        const attrs = textMatch[1];
        const text = textMatch[2];
        // Sub-numbering in same tag: "X.N." or ".N." or ".N)" (Word splits "2.3." → ".3. ")
        const subNumPattern = new RegExp(
          `([\\.\\d]*\\.)(${oldNum})([.\\)\\s])`,
          "",
        );
        if (subNumPattern.test(text)) {
          const newText = text.replace(subNumPattern, `$1${newNum}$3`);
          numReplaced = true;
          return `<w:t${attrs}>${newText}</w:t>`;
        }
        // Simple numbering: "N." or "N)" at start (e.g. "3." → "4.")
        const simpleNumPattern = new RegExp(`(^|\\s)(${oldNum})([.\\)])`, "");
        if (simpleNumPattern.test(text)) {
          const newText = text.replace(simpleNumPattern, `$1${newNum}$3`);
          numReplaced = true;
          return `<w:t${attrs}>${newText}</w:t>`;
        }
        return tag;
      });

      insertXml += clonedXml;
    }

    // Insert cloned paragraphs right after the last paragraph of the template row
    xmlContent =
      xmlContent.slice(0, lastPara.end) +
      insertXml +
      xmlContent.slice(lastPara.end);
  }

  return xmlContent;
}

/**
 * Apply first-line indent of 1cm (567 twips) to ALL paragraphs starting
 * with dash (- – —) that don't already have indent.
 * Uses w:firstLine so only the first line of the paragraph indents;
 * if the text wraps to line 2+, those lines stay at the left margin.
 */
function addDashIndent(xmlContent) {
  return xmlContent.replace(/<w:p[ >][\s\S]*?<\/w:p>/g, (para) => {
    const texts = [];
    para.replace(/<w:t[^>]*>([^<]*)<\/w:t>/g, (_, t) => {
      texts.push(t);
    });
    const fullText = texts.join("").trim();
    if (!/^[-\u2013\u2014]\s/.test(fullText)) return para;
    if (/w:firstLine=/.test(para)) return para;
    if (/<w:ind\b/.test(para)) {
      return para.replace(/<w:ind\b/, '<w:ind w:firstLine="567"');
    }
    if (/<w:pPr>/.test(para)) {
      return para.replace(/<w:pPr>/, '<w:pPr><w:ind w:firstLine="567"/>');
    }
    return para.replace(
      /(<w:p[^>]*>)/,
      '$1<w:pPr><w:ind w:firstLine="567"/></w:pPr>',
    );
  });
}

/**
 * Generate docx by replacing dots patterns with answers (in order)
 * answers = { "0": "Nguyễn Văn A", "1": "15", "2": "06", ... }
 */
async function generateDocx(
  templatePath,
  answers,
  assignedIndices = null,
  dynamicExpansions = null,
  textReplacements = null,
) {
  answers = preprocessAnswers(answers);
  const absolutePath = path.resolve(templatePath);
  const content = fs.readFileSync(absolutePath, "binary");
  const zip = new PizZip(content);

  const xmlFile = "word/document.xml";
  let xmlContent = zip.file(xmlFile)?.asText();
  if (!xmlContent) throw new Error("Cannot read document.xml");

  // Expand dynamic table rows if needed (clone paragraphs before replacement)
  if (dynamicExpansions && dynamicExpansions.length > 0) {
    xmlContent = expandDynamicRows(xmlContent, dynamicExpansions);
    zip.file(xmlFile, xmlContent);
  }

  // Build text segments from <w:t> tags, inserting \n at paragraph boundaries
  // so isBlankDots can detect line context correctly.
  const tagRegex = /<w:t[^>]*>([^<]*)<\/w:t>/g;
  let tagMatch;
  const textSegments = []; // { xmlStart, xmlEnd, fullTag, text, textStart, textEnd, isNewline }
  let runningTextPos = 0;
  let lastParaStart = -1;

  // Find paragraph boundaries
  const paraStarts = new Set();
  const paraRegex = /<w:p[ >\/]/g;
  let pm;
  while ((pm = paraRegex.exec(xmlContent)) !== null) {
    paraStarts.add(pm.index);
  }

  const tableIntervals = computeTableIntervals(xmlContent);

  while ((tagMatch = tagRegex.exec(xmlContent)) !== null) {
    // Check if a new paragraph started between last tag and this tag
    const searchFrom =
      textSegments.length > 0
        ? textSegments[textSegments.length - 1].xmlEnd
        : 0;
    for (const pStart of paraStarts) {
      if (
        pStart > searchFrom &&
        pStart < tagMatch.index &&
        pStart !== lastParaStart
      ) {
        // Insert a virtual \n segment (not mapped to any XML tag)
        textSegments.push({
          xmlStart: -1,
          xmlEnd: -1,
          fullTag: null,
          text: "\n",
          textStart: runningTextPos,
          textEnd: runningTextPos + 1,
          isNewline: true,
        });
        runningTextPos += 1;
        lastParaStart = pStart;
        break;
      }
    }

    const text = tagMatch[1];
    textSegments.push({
      xmlStart: tagMatch.index,
      xmlEnd: tagMatch.index + tagMatch[0].length,
      fullTag: tagMatch[0],
      text,
      textStart: runningTextPos,
      textEnd: runningTextPos + text.length,
      isNewline: false,
      inTable: isXmlPosInTable(tagMatch.index, tableIntervals),
    });
    runningTextPos += text.length;
  }

  const fullText = textSegments.map((s) => s.text).join("");

  // Find all dots and classify them (same logic as parse)
  const dotsRegex = new RegExp(DOTS_RAW.source, "g");
  const rawBlanks = []; // { start, end, continuations: [{start, end}] }
  let dm;
  while ((dm = dotsRegex.exec(fullText)) !== null) {
    // Determine inTable context at this text position by locating the segment
    let inTable = false;
    for (let s = 0; s < textSegments.length; s++) {
      const seg = textSegments[s];
      if (seg.isNewline) continue;
      if (dm.index >= seg.textStart && dm.index < seg.textEnd) {
        inTable = !!seg.inTable;
        break;
      }
    }
    const cls = classifyDots(fullText, dm.index, dm[0].length, { inTable });
    if (cls === "skip") continue;
    if (cls === "continuation") {
      if (rawBlanks.length > 0) {
        rawBlanks[rawBlanks.length - 1].continuations.push({
          start: dm.index,
          end: dm.index + dm[0].length,
        });
      }
      continue;
    }
    rawBlanks.push({
      start: dm.index,
      end: dm.index + dm[0].length,
      continuations: [],
    });
  }

  // Expand: blanks with continuations become 2 entries (same as parseDocxBlanks)
  // Entry 1: original blank (no continuations)
  // Entry 2: continuation blank (replaces all continuation dot ranges with its answer)
  // Exception: dots-only blanks merge continuations into themselves (same as parse)
  const dotsMatches = [];
  for (const blank of rawBlanks) {
    if (blank.continuations.length > 0) {
      // Check if this is a dots-only line blank
      const blankLineStart = fullText.lastIndexOf("\n", blank.start - 1) + 1;
      const blankLineEnd = fullText.indexOf("\n", blank.end);
      const blankLineText = fullText.substring(
        blankLineStart,
        blankLineEnd === -1 ? fullText.length : blankLineEnd,
      );
      const isDotsOnly =
        blankLineText.replace(/[.\s…,\-–—_*=~()\t]+/g, "").length < 2;

      if (isDotsOnly) {
        // Merge: extend blank to cover all continuations, keep them for clearing
        dotsMatches.push(blank); // continuations stay attached for replaceDots to clear them
      } else {
        // Original blank without continuations
        dotsMatches.push({
          start: blank.start,
          end: blank.end,
          continuations: [],
        });
        // Continuation blank: uses first continuation range as primary, rest as its own continuations
        const contRanges = blank.continuations;
        dotsMatches.push({
          start: contRanges[0].start,
          end: contRanges[0].end,
          continuations: contRanges.slice(1),
        });
      }
    } else {
      dotsMatches.push(blank);
    }
  }

  // Helper to replace dots in text segments
  function replaceDots(dotsStart, dotsEnd, replacement) {
    for (let s = textSegments.length - 1; s >= 0; s--) {
      const seg = textSegments[s];
      if (seg.isNewline) continue;

      const overlapStart = Math.max(dotsStart, seg.textStart);
      const overlapEnd = Math.min(dotsEnd, seg.textEnd);

      if (overlapStart < overlapEnd) {
        const localStart = overlapStart - seg.textStart;
        const localEnd = overlapEnd - seg.textStart;
        const isFirst = overlapStart === dotsStart;
        const rep = isFirst ? replacement : "";

        // Mark filled text with markers for post-processing bold removal
        const markedRep = isFirst && replacement ? "\x01" + rep + "\x02" : rep;
        const newText =
          seg.text.substring(0, localStart) +
          markedRep +
          seg.text.substring(localEnd);
        let newTag = seg.fullTag.replace(seg.text, newText);

        // Ensure xml:space="preserve" when text has leading/trailing spaces
        // Check on text without markers (\x01\x02) since those aren't real characters
        const textForSpaceCheck = newText
          .replace(/\x01/g, "")
          .replace(/\x02/g, "");
        if (
          /^\s|\s$/.test(textForSpaceCheck) &&
          !newTag.includes('xml:space="preserve"')
        ) {
          newTag = newTag.replace("<w:t", '<w:t xml:space="preserve"');
        }

        xmlContent =
          xmlContent.substring(0, seg.xmlStart) +
          newTag +
          xmlContent.substring(seg.xmlEnd);
        seg.text = newText;
        seg.fullTag = newTag;
        seg.xmlEnd = seg.xmlStart + newTag.length;
      }
    }
  }

  // Replace backwards to preserve positions
  for (let i = dotsMatches.length - 1; i >= 0; i--) {
    // Skip unassigned blanks (keep dots unchanged)
    if (assignedIndices && !assignedIndices.has(i)) continue;

    const dots = dotsMatches[i];
    const answer = answers[String(i)] || answers[i] || "";
    const hasContinuation = dots.continuations.length > 0;

    // First clear continuation dots (backwards)
    for (let c = dots.continuations.length - 1; c >= 0; c--) {
      const cont = dots.continuations[c];
      replaceDots(cont.start, cont.end, "");
    }

    // Replace only the dots portion with the answer (keep any surrounding text like "202")
    // Auto-strip prefix: if digits/text glued before dots (e.g. "202") is the start of the answer
    // (e.g. "2026"), only fill the remaining part ("6") to avoid duplication like "2022026"
    let finalAnswer = answer;
    if (finalAnswer.length > 0) {
      // Get only digits immediately before dots (not punctuation like "/")
      const prefixMatch = fullText
        .substring(Math.max(0, dots.start - 10), dots.start)
        .match(/(\d+)$/);
      if (prefixMatch) {
        const prefix = prefixMatch[1];
        if (
          finalAnswer.startsWith(prefix) &&
          finalAnswer.length > prefix.length
        ) {
          finalAnswer = finalAnswer.substring(prefix.length);
        }
      }
    }

    // Escape for XML safety
    const safeAnswer = escapeXml(finalAnswer);
    let paddedAnswer = safeAnswer;
    if (safeAnswer.length > 0) {
      const charBefore = dots.start > 0 ? fullText[dots.start - 1] : "";
      const charAfter = dots.end < fullText.length ? fullText[dots.end] : "";
      // Add leading space if char before is a letter/colon/period/paren and answer doesn't start with space
      // (Don't add space after digits — e.g. "202" + "5" = "2025", not "202 5")
      // But DO add space after short numbers (1-2 digits) — those are list numbers like "1.", "2."
      const needLeadingSpace = (() => {
        if (/^\s/.test(answer)) return false;
        if (!charBefore) return false;
        // Letters, colon, period, closing paren → always add space
        if (/[a-zA-Z\u00C0-\u024F\u1E00-\u1EFF:.\)]/.test(charBefore))
          return true;
        // Digit → check if it's a short number (1-2 digits = list item) vs long (3+ = year/ID)
        // Exception: "20" or "19" before dots is a year prefix (20... = 202x), not a list number
        if (/\d/.test(charBefore)) {
          const textBefore = fullText.substring(
            Math.max(0, dots.start - 5),
            dots.start,
          );
          const digitsMatch = textBefore.match(/(\d+)$/);
          if (digitsMatch) {
            const num = digitsMatch[1];
            const isYearPrefix = /^(?:19|20)$/.test(num);
            if (num.length <= 2 && !isYearPrefix) return true; // "1.", "12." → add space
          }
        }
        return false;
      })();
      if (needLeadingSpace) {
        paddedAnswer = " " + paddedAnswer;
      }
      // Add trailing space if char after is a letter/digit/( and answer doesn't end with space
      if (
        charAfter &&
        /[\w\u00C0-\u024F\u1E00-\u1EFF(]/.test(charAfter) &&
        !/\s$/.test(answer)
      ) {
        paddedAnswer = paddedAnswer + " ";
      }
    }
    replaceDots(dots.start, dots.end, paddedAnswer);
  }

  // Post-processing: clean up filled text markers (\x01...\x02)
  // Keep original formatting from template (bold stays bold, normal stays normal)
  // Only ensure Times New Roman 13pt font for filled text
  xmlContent = xmlContent.replace(/<w:r[ >][\s\S]*?<\/w:r>/g, (run) => {
    if (!run.includes("\x01")) return run;
    let cleaned = run;
    // Ensure Times New Roman font
    if (!/<w:rFonts\b/.test(cleaned)) {
      if (/<w:rPr>/.test(cleaned)) {
        cleaned = cleaned.replace(
          /<w:rPr>/,
          '<w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/>',
        );
      } else {
        cleaned = cleaned.replace(
          /<w:r[ >]/,
          (m) =>
            m +
            '<w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/><w:sz w:val="26"/><w:szCs w:val="26"/></w:rPr>',
        );
      }
    }
    // Ensure 13pt (26 half-points) font size
    if (!/<w:sz\b/.test(cleaned) && /<w:rPr>/.test(cleaned)) {
      cleaned = cleaned.replace(
        /<\/w:rPr>/,
        '<w:sz w:val="26"/><w:szCs w:val="26"/></w:rPr>',
      );
    }
    // Remove markers
    cleaned = cleaned.replace(/\x01/g, "").replace(/\x02/g, "");
    return cleaned;
  });
  // Also remove any stray markers (safety)
  xmlContent = xmlContent.replace(/\x01/g, "").replace(/\x02/g, "");

  // Split paragraphs that contain newlines (from rich-text textarea answers).
  // When answer text has \n, the text was inserted into a single <w:t> tag.
  // We need to split into separate <w:p> elements so Word renders them as separate paragraphs.
  // Split paragraphs that contain newlines (from rich-text textarea answers).
  // Filled text uses Times New Roman 13pt. Dash lines get first-line indent 1cm.
  // Formatting (bold/italic) is inherited from the template's original run properties.
  xmlContent = xmlContent.replace(/<w:p[ >][\s\S]*?<\/w:p>/g, (para) => {
    // Check if any <w:t> tag contains a newline
    if (!para.includes("\n")) return para;
    const hasNewlineInText = /<w:t[^>]*>[^<]*\n[^<]*<\/w:t>/.test(para);
    if (!hasNewlineInText) return para;

    // Extract <w:pPr> to reuse for new paragraphs
    const pPrMatch = para.match(/<w:pPr>[\s\S]*?<\/w:pPr>/);
    const basePPr = pPrMatch ? pPrMatch[0] : "";

    // Extract paragraph open tag
    const pOpenMatch = para.match(/^(<w:p[^>]*>)/);
    const pOpen = pOpenMatch ? pOpenMatch[1] : "<w:p>";

    // Collect all content
    const allTexts = [];
    para.replace(/<w:t[^>]*>([^<]*)<\/w:t>/g, (_, t) => {
      allTexts.push(t);
    });
    const fullParaText = allTexts.join("");
    if (!fullParaText.includes("\n")) return para;

    const lines = fullParaText.split("\n").filter((l) => l.trim().length > 0);
    if (lines.length <= 1) return para;

    // Extract <w:rPr> from the run that contains the filled text (has newline)
    // Not the first run, which may be a label like "Trình bày:" with different formatting
    let baseRPr = "";
    const runRegex = /<w:r[ >][\s\S]*?<\/w:r>/g;
    let runM;
    while ((runM = runRegex.exec(para)) !== null) {
      const runText = runM[0];
      // Find run whose <w:t> contains newline — that's the filled text run
      if (/<w:t[^>]*>[^<]*\n/.test(runText)) {
        const rprM = runText.match(/<w:rPr>[\s\S]*?<\/w:rPr>/);
        baseRPr = rprM ? rprM[0] : "";
        break;
      }
    }
    // Fallback: if no run with newline found, use last rPr (most likely the dots run)
    if (!baseRPr) {
      const allRPrs = para.match(/<w:rPr>[\s\S]*?<\/w:rPr>/g);
      baseRPr = allRPrs ? allRPrs[allRPrs.length - 1] : "";
    }

    // Ensure Times New Roman 13pt in rPr
    if (baseRPr) {
      if (!/<w:rFonts\b/.test(baseRPr)) {
        baseRPr = baseRPr.replace(
          /<w:rPr>/,
          '<w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/>',
        );
      }
      if (!/<w:sz\b/.test(baseRPr)) {
        baseRPr = baseRPr.replace(
          /<\/w:rPr>/,
          '<w:sz w:val="26"/><w:szCs w:val="26"/></w:rPr>',
        );
      }
    } else {
      baseRPr =
        '<w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/><w:sz w:val="26"/><w:szCs w:val="26"/></w:rPr>';
    }

    // Build new paragraphs
    const newParas = lines.map((line) => {
      const escaped = line
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
      const spaceAttr = /^\s|\s$/.test(line) ? ' xml:space="preserve"' : "";
      const trimmed = line.trim();

      // Dash items get first-line indent 1cm
      let pPr = basePPr;
      if (/^[-\u2013\u2014]\s/.test(trimmed)) {
        if (pPr && /<w:ind\b/.test(pPr)) {
          if (!/w:firstLine=/.test(pPr)) {
            pPr = pPr.replace(/<w:ind\b/, '<w:ind w:firstLine="567"');
          }
        } else if (pPr) {
          pPr = pPr.replace(/<\/w:pPr>/, '<w:ind w:firstLine="567"/></w:pPr>');
        } else {
          pPr = '<w:pPr><w:ind w:firstLine="567"/></w:pPr>';
        }
      }

      const run = `<w:r>${baseRPr}<w:t${spaceAttr}>${escaped}</w:t></w:r>`;
      return `${pOpen}${pPr}${run}</w:p>`;
    });

    return newParas.join("");
  });

  // Clean up paragraphs left behind after clearing continuation dots.
  // Paragraphs that had dots-only content and are now empty: keep the paragraph
  // structure (for spacing) but strip the empty runs to avoid rendering artifacts.
  const emptyParaRegex = /<w:p[ >/][\s\S]*?<\/w:p>/g;
  xmlContent = xmlContent.replace(emptyParaRegex, (paraMatch) => {
    // Extract all text from <w:t> tags within this paragraph
    const textParts = [];
    const wtRegex = /<w:t[^>]*>([^<]*)<\/w:t>/g;
    let wtMatch;
    while ((wtMatch = wtRegex.exec(paraMatch)) !== null) {
      textParts.push(wtMatch[1]);
    }
    const textContent = textParts.join("");
    const hasTextTags = textParts.length > 0;
    if (hasTextTags && textContent.trim().length === 0) {
      // Keep the paragraph for spacing but strip all runs (<w:r>...</w:r>)
      // Preserve <w:pPr> for formatting
      const pOpenMatch = paraMatch.match(/^(<w:p[^>]*>)/);
      const pOpen = pOpenMatch ? pOpenMatch[1] : "<w:p>";
      const pPrMatch = paraMatch.match(/<w:pPr>[\s\S]*?<\/w:pPr>/);
      const pPr = pPrMatch ? pPrMatch[0] : "";
      return `${pOpen}${pPr}</w:p>`;
    }
    return paraMatch;
  });

  // Text replacements: find exact text in Word XML and replace sequentially
  // Handles text split across multiple <w:t> tags while preserving <w:tab/> boundaries
  if (textReplacements && textReplacements.length > 0) {
    const bySearchOrdered = {};
    for (const tr of textReplacements) {
      if (!bySearchOrdered[tr.search]) bySearchOrdered[tr.search] = [];
      bySearchOrdered[tr.search].push(tr.replace);
    }
    for (const [searchText, replaceValues] of Object.entries(bySearchOrdered)) {
      let replaceIdx = 0;
      xmlContent = xmlContent.replace(/<w:p[ >][\s\S]*?<\/w:p>/g, (para) => {
        if (replaceIdx >= replaceValues.length) return para;
        let result = para;
        let replacedInParagraph = true;
        while (replacedInParagraph && replaceIdx < replaceValues.length) {
          replacedInParagraph = false;
          const segs = [];
          const tRegex = /(<w:t[^>]*>)([^<]*)(<\/w:t>)/g;
          let m;
          while ((m = tRegex.exec(result)) !== null) {
            if (segs.length > 0) {
              const between = result.substring(
                segs[segs.length - 1].end,
                m.index,
              );
              if (between.includes("<w:tab/>")) {
                segs.length = 0;
              }
            }
            segs.push({
              start: m.index,
              end: m.index + m[0].length,
              openTag: m[1],
              text: m[2],
              closeTag: m[3],
            });
            const joinedText = segs.map((s) => s.text).join("");
            if (!joinedText.includes(searchText)) continue;

            const nextText = joinedText.replace(
              searchText,
              replaceValues[replaceIdx++],
            );
            for (let i = segs.length - 1; i >= 0; i--) {
              const seg = segs[i];
              const newText = i === 0 ? nextText : "";
              let replacement = seg.openTag + newText + seg.closeTag;
              if (
                newText &&
                /^\s|\s$/.test(newText) &&
                !replacement.includes('xml:space="preserve"')
              ) {
                replacement = replacement.replace(
                  "<w:t",
                  '<w:t xml:space="preserve"',
                );
              }
              result =
                result.substring(0, seg.start) +
                replacement +
                result.substring(seg.end);
            }
            replacedInParagraph = true;
            break;
          }
        }
        return result;
      });
    }
    textReplacements = null;
  }
  if (textReplacements && textReplacements.length > 0) {
    const bySearch = {};
    for (const tr of textReplacements) {
      if (!bySearch[tr.search]) bySearch[tr.search] = [];
      bySearch[tr.search].push(tr.replace);
    }
    for (const [searchText, replaceValues] of Object.entries(bySearch)) {
      let replaceIdx = 0;
      // Process each <w:r> run: try simple single-tag replacement first
      xmlContent = xmlContent.replace(/<w:r[ >][\s\S]*?<\/w:r>/g, (run) => {
        if (replaceIdx >= replaceValues.length) return run;
        // Check if this run's <w:t> contains the search text
        const tMatch = run.match(/(<w:t[^>]*>)([^<]*)(<\/w:t>)/);
        if (!tMatch) return run;
        const text = tMatch[2];
        if (!text.includes(searchText)) return run;
        // Replace first occurrence in this run
        const newText = text.replace(searchText, replaceValues[replaceIdx++]);
        let newTag = tMatch[1] + newText + tMatch[3];
        if (
          /^\s|\s$/.test(newText) &&
          !newTag.includes('xml:space="preserve"')
        ) {
          newTag = newTag.replace("<w:t", '<w:t xml:space="preserve"');
        }
        return run.replace(tMatch[0], newTag);
      });

      // If still have replacements left, try cross-tag approach within runs separated by <w:tab/>
      if (replaceIdx < replaceValues.length) {
        xmlContent = xmlContent.replace(/<w:p[ >][\s\S]*?<\/w:p>/g, (para) => {
          if (replaceIdx >= replaceValues.length) return para;
          // Split paragraph into groups separated by <w:tab/>
          // Find consecutive <w:t> tags not separated by <w:tab/>
          const segs = [];
          const tRegex = /(<w:t[^>]*>)([^<]*)(<\/w:t>)/g;
          let m;
          while ((m = tRegex.exec(para)) !== null) {
            // Check if there's a <w:tab/> between this and previous segment
            if (segs.length > 0) {
              const between = para.substring(
                segs[segs.length - 1].end,
                m.index,
              );
              if (between.includes("<w:tab/>")) {
                // Process accumulated group
                segs.length = 0; // reset — this group didn't match
              }
            }
            segs.push({
              start: m.index,
              end: m.index + m[0].length,
              openTag: m[1],
              text: m[2],
              closeTag: m[3],
            });
            const fullText = segs.map((s) => s.text).join("");
            if (
              fullText.includes(searchText) &&
              replaceIdx < replaceValues.length
            ) {
              // Found match across tags — replace
              let newFullText = fullText.replace(
                searchText,
                replaceValues[replaceIdx++],
              );
              let result = para;
              for (let i = segs.length - 1; i >= 0; i--) {
                const seg = segs[i];
                const newText = i === 0 ? newFullText : "";
                let replacement = seg.openTag + newText + seg.closeTag;
                if (
                  newText &&
                  /^\s|\s$/.test(newText) &&
                  !replacement.includes('xml:space="preserve"')
                ) {
                  replacement = replacement.replace(
                    "<w:t",
                    '<w:t xml:space="preserve"',
                  );
                }
                result =
                  result.substring(0, seg.start) +
                  replacement +
                  result.substring(seg.end);
              }
              para = result;
              segs.length = 0;
            }
          }
          return para;
        });
      }
    }
  }

  // Apply first-line indent to dash paragraphs
  xmlContent = addDashIndent(xmlContent);

  zip.file(xmlFile, xmlContent);

  const buf = new Docxtemplater(zip, { paragraphLoop: true, linebreaks: true })
    .getZip()
    .generate({ type: "nodebuffer", compression: "DEFLATE" });

  const filename = `doc_${Date.now()}.docx`;
  const outputPath = path.join(GENERATED_DIR, filename);
  fs.writeFileSync(outputPath, buf);

  return `/uploads/generated/${filename}`;
}

/**
 * Generate xlsx by replacing dots patterns with answers (in order)
 */
async function generateXlsx(templatePath, answers, assignedIndices = null) {
  answers = preprocessAnswers(answers);
  const absolutePath = path.resolve(templatePath);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(absolutePath);

  let answerIndex = 0;

  workbook.eachSheet((sheet) => {
    sheet.eachRow((row) => {
      row.eachCell((cell) => {
        if (typeof cell.value === "string") {
          // Process dots patterns with spacing and digit-prefix handling
          const dotsRegex = new RegExp(DOTS_RAW.source, "g");
          let result = "";
          let lastEnd = 0;
          let dm;
          while ((dm = dotsRegex.exec(cell.value)) !== null) {
            const cls = classifyDots(cell.value, dm.index, dm[0].length);
            if (cls === "skip") {
              result += cell.value.substring(lastEnd, dm.index + dm[0].length);
              lastEnd = dm.index + dm[0].length;
              continue;
            }
            if (cls === "continuation") {
              result += cell.value.substring(lastEnd, dm.index);
              lastEnd = dm.index + dm[0].length;
              continue;
            }
            // Blank: replace only dots portion (keep surrounding digits like "202")
            // Skip unassigned blanks
            if (assignedIndices && !assignedIndices.has(answerIndex)) {
              result += cell.value.substring(lastEnd, dm.index + dm[0].length);
              lastEnd = dm.index + dm[0].length;
              answerIndex++;
              continue;
            }
            result += cell.value.substring(lastEnd, dm.index);

            let answer = answers[String(answerIndex)] || "";
            if (answer.length > 0) {
              const charBefore = dm.index > 0 ? cell.value[dm.index - 1] : "";
              const charAfter =
                dm.index + dm[0].length < cell.value.length
                  ? cell.value[dm.index + dm[0].length]
                  : "";
              let padded = "";
              if (
                charBefore &&
                /[a-zA-Z\u00C0-\u024F\u1E00-\u1EFF:]/.test(charBefore)
              )
                padded += " ";
              padded += answer;
              if (
                charAfter &&
                /[\w\u00C0-\u024F\u1E00-\u1EFF(]/.test(charAfter)
              )
                padded += " ";
              result += padded;
            }
            answerIndex++;
            lastEnd = dm.index + dm[0].length;
          }
          result += cell.value.substring(lastEnd);
          cell.value = result;
        }
      });
    });
  });

  const filename = `doc_${Date.now()}.xlsx`;
  const outputPath = path.join(GENERATED_DIR, filename);
  await workbook.xlsx.writeFile(outputPath);

  return `/uploads/generated/${filename}`;
}

/**
 * Main entry point
 */
async function generateDocument(
  templatePath,
  templateType,
  answers,
  assignedIndices = null,
  dynamicExpansions = null,
  textReplacements = null,
) {
  if (templateType === "docx") {
    return generateDocx(
      templatePath,
      answers,
      assignedIndices,
      dynamicExpansions,
      textReplacements,
    );
  } else if (templateType === "xlsx") {
    return generateXlsx(templatePath, answers, assignedIndices);
  }
  throw new Error(`Unsupported template type: ${templateType}`);
}

/**
 * Parse blanks grouped by document line (for preview panel).
 * Returns array of { lineNum, text (with [___] replacing dots), blanks: [index, ...] }
 * Only returns lines that contain at least one blank.
 */
function parseBlanksByLine(templatePath, templateType) {
  if (templateType !== "docx") return [];

  // Reuse parseDocxBlanks to get the exact same blanks with correct indices
  const blanks = parseDocxBlanks(templatePath);
  if (blanks.length === 0) return [];

  const fullText = extractDocxFullText(templatePath);
  const lines = fullText.split("\n");

  // Build line offsets
  let charOffset = 0;
  const lineOffsets = [];
  for (let i = 0; i < lines.length; i++) {
    lineOffsets.push({ start: charOffset, end: charOffset + lines[i].length });
    charOffset += lines[i].length + 1;
  }

  // Find line number for a character position
  function getLineNum(pos) {
    for (let i = 0; i < lineOffsets.length; i++) {
      if (pos >= lineOffsets[i].start && pos < lineOffsets[i].end + 1) return i;
    }
    return lineOffsets.length - 1;
  }

  // Map each blank to its line, using dotsStart from parseDocxBlanks
  // Continuation blanks show on same line as their parent blank (not on dots-only lines)
  const lineMap = new Map(); // lineNum -> [{ index, dotsStart, dotsEnd }]
  for (let i = 0; i < blanks.length; i++) {
    const blank = blanks[i];
    if (blank._isContinuationBlank) {
      // Show continuation blank on same line as its parent (previous blank)
      const parentIdx = i - 1;
      if (parentIdx >= 0) {
        const parentLine = getLineNum(blanks[parentIdx].dotsStart);
        if (!lineMap.has(parentLine)) lineMap.set(parentLine, []);
        // Don't add dotsStart/dotsEnd — it won't be replaced on the line text
        lineMap.get(parentLine).push({ index: i, dotsStart: -1, dotsEnd: -1 });
      }
    } else {
      const lineNum = getLineNum(blank.dotsStart);
      if (!lineMap.has(lineNum)) lineMap.set(lineNum, []);
      lineMap
        .get(lineNum)
        .push({ index: i, dotsStart: blank.dotsStart, dotsEnd: blank.dotsEnd });
    }
  }

  // Build result: for each line with blanks, replace dots with [___]
  const result = [];
  const sortedLines = [...lineMap.keys()].sort((a, b) => a - b);

  for (const lineNum of sortedLines) {
    const lineText = lines[lineNum];
    const lineBlanks = lineMap.get(lineNum);
    const lineStart = lineOffsets[lineNum].start;

    // Sort blanks by position on line
    lineBlanks.sort((a, b) => a.dotsStart - b.dotsStart);

    // Replace dots at exact positions from parseDocxBlanks
    let replaced = "";
    let lastEnd = 0;
    for (const b of lineBlanks) {
      const relStart = b.dotsStart - lineStart;
      const relEnd = b.dotsEnd - lineStart;
      if (relStart >= 0 && relEnd <= lineText.length) {
        replaced += lineText.substring(lastEnd, relStart);
        replaced += "[___]";
        lastEnd = relEnd;
      }
    }
    replaced += lineText.substring(lastEnd);

    const trimmed = replaced.trim();
    if (!trimmed) continue;

    result.push({
      lineNum,
      text: trimmed,
      blanks: lineBlanks.map((b) => b.index),
    });
  }

  return result;
}

module.exports = {
  generateDocument,
  generateDocx,
  generateXlsx,
  parseBlanks,
  parseBlanksByLine,
  expandDynamicRows,
};
