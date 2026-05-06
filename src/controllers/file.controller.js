const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { File } = require('../models');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { successResponse, paginatedResponse } = require('../utils/response');
const { parsePagination } = require('../utils/pagination');

function getFileHash(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('md5');
    const stream = fs.createReadStream(filePath);
    stream.on('data', (data) => hash.update(data));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', reject);
  });
}

// POST /api/admin/files/upload
exports.upload = asyncHandler(async (req, res) => {
  if (!req.file) throw new ApiError(400, 'No file uploaded');

  const type = req.query.type || 'images';
  const uploadDir = path.join(process.env.UPLOAD_DIR || './uploads', type);
  const uploadedFilePath = path.join(uploadDir, req.file.filename);

  // Check duplicate by hash
  const hash = await getFileHash(uploadedFilePath);
  const existing = await File.findOne({ where: { file_hash: hash } });

  if (existing) {
    const existingFilePath = path.resolve(path.join(process.env.UPLOAD_DIR || './uploads', existing.file_path));
    const newFilePath = path.resolve(uploadedFilePath);

    // Only reuse if old file exists AND is a different file from what we just uploaded
    if (fs.existsSync(existingFilePath) && existingFilePath !== newFilePath) {
      // Old file still exists on disk — delete newly uploaded duplicate
      fs.unlinkSync(uploadedFilePath);

      const responseData = {
        ...existing.toJSON(),
        url: `${process.env.APP_URL}/uploads${existing.file_path}`,
        deduplicated: true,
      };

      return successResponse(res, responseData, 'File already exists, reusing', 200);
    }

    // Old file was deleted (or multer overwrote same path) — use new file, update DB record
    // Ensure stored_name is unique in DB (another record may hold the same name)
    let uniqueStoredName = req.file.filename;
    const conflicting = await File.findOne({ where: { stored_name: uniqueStoredName } });
    if (conflicting && conflicting.id !== existing.id) {
      const ext = path.extname(uniqueStoredName);
      const base = path.basename(uniqueStoredName, ext);
      let counter = 1;
      while (await File.findOne({ where: { stored_name: `${base}(${counter})${ext}` } })) {
        counter++;
      }
      // Rename the file on disk too
      const oldPath = path.join(uploadDir, req.file.filename);
      uniqueStoredName = `${base}(${counter})${ext}`;
      const newPath = path.join(uploadDir, uniqueStoredName);
      if (fs.existsSync(oldPath)) fs.renameSync(oldPath, newPath);
    }
    const newStoredPath = `/${type}/${uniqueStoredName}`;
    await existing.update({
      stored_name: uniqueStoredName,
      file_path: newStoredPath,
      original_name: req.file.originalname,
    });

    const responseData = {
      ...existing.toJSON(),
      file_path: newStoredPath,
      stored_name: req.file.filename,
      original_name: req.file.originalname,
      url: `${process.env.APP_URL}/uploads${newStoredPath}`,
      deduplicated: true,
    };

    return successResponse(res, responseData, 'File re-uploaded, record updated', 200);
  }

  // Ensure stored_name is unique in DB before creating
  let finalStoredName = req.file.filename;
  const nameConflict = await File.findOne({ where: { stored_name: finalStoredName } });
  if (nameConflict) {
    const ext = path.extname(finalStoredName);
    const base = path.basename(finalStoredName, ext);
    let counter = 1;
    while (await File.findOne({ where: { stored_name: `${base}(${counter})${ext}` } })) {
      counter++;
    }
    const oldPath = path.join(uploadDir, req.file.filename);
    finalStoredName = `${base}(${counter})${ext}`;
    const newPath = path.join(uploadDir, finalStoredName);
    if (fs.existsSync(oldPath)) fs.renameSync(oldPath, newPath);
  }
  const storedPath = `/${type}/${finalStoredName}`;

  const file = await File.create({
    original_name: req.file.originalname,
    stored_name: finalStoredName,
    file_path: storedPath,
    mime_type: req.file.mimetype,
    file_size: req.file.size,
    file_hash: hash,
    uploaded_by: req.user.id,
  });

  const responseData = {
    ...file.toJSON(),
    url: `${process.env.APP_URL}/uploads${file.file_path}`,
  };

  return successResponse(res, responseData, 'File uploaded', 201);
});

// POST /api/admin/files/upload-multiple
exports.uploadMultiple = asyncHandler(async (req, res) => {
  if (!req.files || req.files.length === 0) throw new ApiError(400, 'No files uploaded');

  const type = req.query.type || 'images';
  const files = await Promise.all(
    req.files.map(f =>
      File.create({
        original_name: f.originalname,
        stored_name: f.filename,
        file_path: `/${type}/${f.filename}`,
        mime_type: f.mimetype,
        file_size: f.size,
        uploaded_by: req.user.id,
      })
    )
  );

  return successResponse(res, files, `${files.length} files uploaded`, 201);
});

// GET /api/admin/files
exports.getAll = asyncHandler(async (req, res) => {
  const { page, limit, offset } = parsePagination(req.query);

  const { count, rows } = await File.findAndCountAll({
    include: [{ association: 'uploader', attributes: ['id', 'full_name'] }],
    order: [['created_at', 'DESC']],
    limit,
    offset,
  });

  return paginatedResponse(res, rows, count, page, limit);
});

// DELETE /api/admin/files/:id
exports.remove = asyncHandler(async (req, res) => {
  const file = await File.findByPk(req.params.id);
  if (!file) throw new ApiError(404, 'File not found');

  const uploadDir = process.env.UPLOAD_DIR || './uploads';
  const filePath = path.join(uploadDir, file.file_path);

  // Delete original file
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }

  // Delete generated thumbnails
  const ext = path.extname(filePath);
  const base = filePath.slice(0, -ext.length);
  for (const suffix of ['_slider', '_thumb']) {
    const thumbPath = `${base}${suffix}${ext}`;
    if (fs.existsSync(thumbPath)) {
      fs.unlinkSync(thumbPath);
    }
  }

  await file.destroy();
  return successResponse(res, null, 'File deleted');
});
