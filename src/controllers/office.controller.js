const { Office } = require('../models');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { successResponse } = require('../utils/response');

// GET /api/admin/offices
exports.getAll = asyncHandler(async (req, res) => {
  const offices = await Office.findAll({ order: [['sort_order', 'ASC']] });
  return successResponse(res, offices);
});

// POST /api/admin/offices
exports.create = asyncHandler(async (req, res) => {
  const office = await Office.create(req.body);
  return successResponse(res, office, 'Office created', 201);
});

// PUT /api/admin/offices/:id
exports.update = asyncHandler(async (req, res) => {
  const office = await Office.findByPk(req.params.id);
  if (!office) throw new ApiError(404, 'Office not found');

  await office.update(req.body);
  return successResponse(res, office, 'Office updated');
});

// DELETE /api/admin/offices/:id
exports.remove = asyncHandler(async (req, res) => {
  const office = await Office.findByPk(req.params.id);
  if (!office) throw new ApiError(404, 'Office not found');

  await office.destroy();
  return successResponse(res, null, 'Office deleted');
});
