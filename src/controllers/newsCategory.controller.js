const { NewsCategory } = require('../models');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { successResponse } = require('../utils/response');
const { slugify } = require('../utils/slugify');

// GET /api/admin/news-categories
exports.getAll = asyncHandler(async (req, res) => {
  const categories = await NewsCategory.findAll({ order: [['sort_order', 'ASC']] });
  return successResponse(res, categories);
});

// POST /api/admin/news-categories
exports.create = asyncHandler(async (req, res) => {
  const { name, sort_order } = req.body;
  const slug = slugify(name);

  const category = await NewsCategory.create({
    name, slug,
    sort_order: sort_order || 0,
  });

  return successResponse(res, category, 'Category created', 201);
});

// PUT /api/admin/news-categories/:id
exports.update = asyncHandler(async (req, res) => {
  const category = await NewsCategory.findByPk(req.params.id);
  if (!category) throw new ApiError(404, 'Category not found');

  const { name, sort_order, is_active } = req.body;
  if (name !== undefined) { category.name = name; category.slug = slugify(name); }
  if (sort_order !== undefined) category.sort_order = sort_order;
  if (is_active !== undefined) category.is_active = is_active;

  await category.save();
  return successResponse(res, category, 'Category updated');
});

// DELETE /api/admin/news-categories/:id
exports.remove = asyncHandler(async (req, res) => {
  const category = await NewsCategory.findByPk(req.params.id);
  if (!category) throw new ApiError(404, 'Category not found');

  await category.destroy();
  return successResponse(res, null, 'Category deleted');
});
