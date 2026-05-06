const { SiteSetting } = require('../models');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { successResponse } = require('../utils/response');

// GET /api/admin/settings
exports.getAll = asyncHandler(async (req, res) => {
  const settings = await SiteSetting.findAll({ order: [['id', 'ASC']] });
  return successResponse(res, settings);
});

// POST /api/admin/settings
exports.create = asyncHandler(async (req, res) => {
  const { key, value, description } = req.body;
  const setting = await SiteSetting.create({ key, value, description });
  return successResponse(res, setting, 'Setting created', 201);
});

// PUT /api/admin/settings/:key
exports.updateByKey = asyncHandler(async (req, res) => {
  const setting = await SiteSetting.findOne({ where: { key: req.params.key } });
  if (!setting) throw new ApiError(404, 'Setting not found');

  const { value, description } = req.body;
  if (value !== undefined) setting.value = value;
  if (description !== undefined) setting.description = description;

  await setting.save();
  return successResponse(res, setting, 'Setting updated');
});
