const multer = require('multer');
const path = require('path');
const fs = require('fs');

function decodeFilename(name) {
  // Multer encodes originalname as latin1; decode to utf8
  try {
    return Buffer.from(name, 'latin1').toString('utf8');
  } catch {
    return name;
  }
}

function getUniqueFilename(dir, originalName) {
  const decoded = decodeFilename(originalName);
  const ext = path.extname(decoded);
  const base = path.basename(decoded, ext)
    .replace(/[^a-zA-Z0-9_\-\.\s\u00C0-\u024F\u1E00-\u1EFF]/g, '')
    .replace(/\s+/g, '-');

  let filename = `${base}${ext}`;
  let counter = 1;

  while (fs.existsSync(path.join(dir, filename))) {
    filename = `${base}(${counter})${ext}`;
    counter++;
  }

  return filename;
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const type = req.query.type || 'images';
    const uploadDir = process.env.UPLOAD_DIR || './uploads';
    cb(null, path.join(uploadDir, type));
  },
  filename: (req, file, cb) => {
    const type = req.query.type || 'images';
    const uploadDir = process.env.UPLOAD_DIR || './uploads';
    const dir = path.join(uploadDir, type);
    const filename = getUniqueFilename(dir, file.originalname);
    cb(null, filename);
  },
});

const fileFilter = (req, file, cb) => {
  const type = req.query.type || 'images';
  const allowedMimes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

  // Allow document files for templates
  if (type === 'templates') {
    const docMimes = [
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ];
    if (docMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only .docx and .xlsx are allowed for templates.'), false);
    }
    return;
  }

  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only JPEG, PNG, GIF, and WebP are allowed.'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: parseInt(process.env.MAX_FILE_SIZE) || 5 * 1024 * 1024 },
});

module.exports = upload;
