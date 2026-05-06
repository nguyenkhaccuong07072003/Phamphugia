const { SocialLink } = require('../models');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { successResponse } = require('../utils/response');

// GET /api/admin/social-links
exports.getAll = asyncHandler(async (req, res) => {
  const links = await SocialLink.findAll({ order: [['platform', 'ASC'], ['sort_order', 'ASC']] });
  return successResponse(res, links);
});

// POST /api/admin/social-links
exports.create = asyncHandler(async (req, res) => {
  const link = await SocialLink.create(req.body);
  return successResponse(res, link, 'Social link created', 201);
});

// PUT /api/admin/social-links/:id
exports.update = asyncHandler(async (req, res) => {
  const link = await SocialLink.findByPk(req.params.id);
  if (!link) throw new ApiError(404, 'Social link not found');

  await link.update(req.body);
  return successResponse(res, link, 'Social link updated');
});

// DELETE /api/admin/social-links/:id
exports.remove = asyncHandler(async (req, res) => {
  const link = await SocialLink.findByPk(req.params.id);
  if (!link) throw new ApiError(404, 'Social link not found');

  await link.destroy();
  return successResponse(res, null, 'Social link deleted');
});
