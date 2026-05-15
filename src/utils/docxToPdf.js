const { execFile } = require("child_process");
const crypto = require("crypto");
const fs = require("fs");
const os = require("os");
const path = require("path");

/**
 * Word COM không an toàn khi chạy song song — hàng đợi serialize các lần **cần gọi Word**.
 * Cache PDF phải xử lý **trước** khi vào hàng đợi: nếu không, một job Word treo sẽ chặn mọi /print
 * dù PDF đã có sẵn (pending vô hạn phía client).
 */
let conversionQueue = Promise.resolve();

function enqueueConversion(fn) {
  const next = conversionQueue.then(() => fn());
  conversionQueue = next.catch(() => {});
  return next;
}

/** Mặc định 2 phút; Word COM thường 2–30s. Có thể ghi đè: WORD_CONVERSION_TIMEOUT_MS=90000 */
const WORD_CONVERSION_TIMEOUT_MS =
  Number(process.env.WORD_CONVERSION_TIMEOUT_MS) || 120_000;

function execFileAsync(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    execFile(command, args, options, (err, stdout, stderr) => {
      if (err) {
        err.stdout = stdout;
        err.stderr = stderr;
        reject(err);
        return;
      }
      resolve({ stdout, stderr });
    });
  });
}

function buildTimeoutError(err) {
  const timedOut =
    err.killed === true ||
    err.code === "ETIMEDOUT" ||
    err.signal === "SIGTERM" ||
    err.signal === "SIGKILL";

  if (timedOut) {
    return new Error(
      `docxToPdf timed out after ${WORD_CONVERSION_TIMEOUT_MS}ms`,
    );
  }

  return null;
}

function formatExecError(prefix, err) {
  const timeoutErr = buildTimeoutError(err);
  if (timeoutErr) return timeoutErr;

  const details = [err.message, err.stderr || "", err.stdout || ""]
    .filter(Boolean)
    .join("\n");

  return new Error(`${prefix}: ${details}`);
}

function tryUnlinkSync(filePath) {
  try {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch {
    /* EBUSY / đang quét — bỏ qua */
  }
}

/** PDF đã có và không cũ hơn DOCX — dùng cả ở đầu docxToPdf và trong hàng đợi (tránh chạy Word 2 lần khi job nền vừa xong). */
function isPdfCacheFresh(outputPath, inputPath) {
  if (!fs.existsSync(outputPath) || !fs.existsSync(inputPath)) return false;
  const pdfStat = fs.statSync(outputPath);
  if (pdfStat.size === 0) return false;
  const docStat = fs.statSync(inputPath);
  return pdfStat.mtimeMs >= docStat.mtimeMs;
}

/**
 * Convert DOCX -> PDF using Microsoft Word COM automation (Windows).
 * Requirements:
 * - Must run on Windows
 * - Microsoft Word must be installed
 */
async function docxToPdf(inputPath, outputPath) {
  // Đường nhanh: đã có PDF ≥ DOCX — không vào hàng đợi (không chờ job Word khác).
  if (isPdfCacheFresh(outputPath, inputPath)) return;

  // Dùng timeout của execFile để kill PowerShell/Word — tránh race với Promise.race (timeout nhưng process vẫn chạy → treo hàng đợi, pending vô hạn phía client).
  return enqueueConversion(async () => {
    // Khi đến lượt chạy, job nền có thể đã ghi xong PDF — bỏ qua Word (tránh ~5s thừa).
    if (isPdfCacheFresh(outputPath, inputPath)) return;
    return docxToPdfImpl(inputPath, outputPath);
  });
}

async function docxToPdfImpl(inputPath, outputPath) {
  if (!fs.existsSync(inputPath)) {
    throw new Error(`Input DOCX not found: ${inputPath}`);
  }

  const tmpDir = os.tmpdir();
  const id = crypto.randomBytes(8).toString("hex");
  const tempDocx = path.join(tmpDir, `maxcell-docx-${id}.docx`);
  const tempPdf = path.join(tmpDir, `maxcell-out-${id}.pdf`);
  const tempPs1 = path.join(tmpDir, `maxcell-docpdf-${id}.ps1`);

  fs.copyFileSync(inputPath, tempDocx);

  try {
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });

    if (process.platform === "win32") {
      await convertWithWordCom(tempDocx, tempPdf, tempPs1);
    } else {
      await convertWithLibreOffice(tempDocx, tempPdf);
    }

    if (!fs.existsSync(tempPdf) || fs.statSync(tempPdf).size === 0) {
      throw new Error(`PDF not generated: ${tempPdf}`);
    }

    fs.copyFileSync(tempPdf, outputPath);

    if (!fs.existsSync(outputPath) || fs.statSync(outputPath).size === 0) {
      throw new Error(`PDF not copied to: ${outputPath}`);
    }
  } finally {
    tryUnlinkSync(tempDocx);
    tryUnlinkSync(tempPdf);
    tryUnlinkSync(tempPs1);
  }
}

async function convertWithWordCom(tempDocx, tempPdf, tempPs1) {
  // Word chỉ mở bản copy trong %TEMP% — file gốc trong uploads ít bị khóa / dialog "File In Use".
  // PDF ghi ra temp trước, rồi copy sang đích (tránh Word giữ handle lên đường dẫn cuối).
  const inputJson = JSON.stringify(tempDocx);
  const outputJson = JSON.stringify(tempPdf);

  // Không dùng $input / $output — là biến tự động trong PowerShell, dễ làm Open/Export sai.
  // `-Command` multi-line trên Windows dễ lỗi → chạy bằng file .ps1 tạm.
  const ps1Body = [
    '$ErrorActionPreference = "Stop"',
    `$inDocx = ${inputJson}`,
    `$outPdf = ${outputJson}`,
    "$word = New-Object -ComObject Word.Application",
    "$word.Visible = $false",
    "$word.DisplayAlerts = 0",
    "$doc = $word.Documents.Open($inDocx)",
    "$doc.ExportAsFixedFormat($outPdf, 17, $false) | Out-Null",
    "$doc.Close() | Out-Null",
    "$word.Quit() | Out-Null",
    "",
  ].join("\r\n");

  fs.writeFileSync(tempPs1, ps1Body, "utf8");

  try {
    await execFileAsync(
      "powershell.exe",
      ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", tempPs1],
      {
        timeout: WORD_CONVERSION_TIMEOUT_MS,
        maxBuffer: 20 * 1024 * 1024,
        windowsHide: true,
      },
    );
  } catch (err) {
    if (err.code === "ENOENT") {
      throw new Error(
        "DOCX->PDF conversion failed: powershell.exe not found on this Windows host",
      );
    }
    throw formatExecError("DOCX->PDF conversion failed", err);
  }
}

async function convertWithLibreOffice(tempDocx, tempPdf) {
  const outDir = path.dirname(tempPdf);
  const targetPdf = path.join(
    outDir,
    `${path.basename(tempDocx, ".docx")}.pdf`,
  );
  const commands = ["soffice", "libreoffice"];
  let lastError = null;

  // Tạo một đường dẫn profile tạm thời dựa trên tên file để cô lập môi trường render
  const profileDir = path.join(
    os.tmpdir(),
    `libre_profile_${path.basename(tempDocx, ".docx")}`,
  );

  for (const command of commands) {
    try {
      await execFileAsync(
        command,
        [
          "--headless",
          "--invisible",
          // Ép LibreOffice dùng profile sạch để giữ nguyên định dạng bảng và lề trang
          `-env:UserInstallation=file://${profileDir}`,
          "--convert-to",
          "pdf:writer_pdf_Export",
          "--outdir",
          outDir,
          tempDocx,
        ],
        {
          timeout: WORD_CONVERSION_TIMEOUT_MS,
          maxBuffer: 20 * 1024 * 1024,
        },
      );

      if (targetPdf !== tempPdf && fs.existsSync(targetPdf)) {
        fs.renameSync(targetPdf, tempPdf);
      }

      // Xóa folder profile tạm sau khi xong để giải phóng dung lượng
      try {
        fs.rmSync(profileDir, { recursive: true, force: true });
      } catch (e) {}

      return;
    } catch (err) {
      lastError = err;
      // Dọn dẹp profile nếu lỗi xảy ra
      try {
        fs.rmSync(profileDir, { recursive: true, force: true });
      } catch (e) {}
      if (err.code !== "ENOENT") break;
    }
  }

  if (lastError && lastError.code === "ENOENT") {
    throw new Error(
      "DOCX->PDF conversion failed: LibreOffice is not installed in this container/host",
    );
  }

  throw formatExecError("DOCX->PDF conversion failed", lastError);
}

module.exports = { docxToPdf };
