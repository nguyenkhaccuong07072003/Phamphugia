const { Slide } = require('../models');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { successResponse } = require('../utils/response');

// GET /api/admin/slides
exports.getAll = asyncHandler(async (req, res) => {
  const slides = await Slide.findAll({ order: [['sort_order', 'ASC']] });
  return successResponse(res, slides);
});

// POST /api/admin/slides
exports.create = asyncHandler(async (req, res) => {
  const slide = await Slide.create(req.body);
  return successResponse(res, slide, 'Slide created', 201);
});

// PUT /api/admin/slides/:id
exports.update = asyncHandler(async (req, res) => {
  const slide = await Slide.findByPk(req.params.id);
  if (!slide) throw new ApiError(404, 'Slide not found');

  await slide.update(req.body);
  return successResponse(res, slide, 'Slide updated');
});

// DELETE /api/admin/slides/:id
exports.remove = asyncHandler(async (req, res) => {
  const slide = await Slide.findByPk(req.params.id);
  if (!slide) throw new ApiError(404, 'Slide not found');

  await slide.destroy();
  return successResponse(res, null, 'Slide deleted');
});
