const { NewsArticle, NewsCategory, User, Department } = require('../models');
const { Op } = require('sequelize');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { successResponse, paginatedResponse } = require('../utils/response');
const { slugify } = require('../utils/slugify');
const { parsePagination } = require('../utils/pagination');

function normalizeImageUrls(imageUrls) {
  if (!Array.isArray(imageUrls)) return [];
  return imageUrls.filter((url) => typeof url === 'string' && url.trim() !== '');
}

// GET /api/admin/news
exports.getAll = asyncHandler(async (req, res) => {
  const { page, limit, offset } = parsePagination(req.query);
  const { search, category_id, status, display_filter } = req.query;

  const where = {};
  if (search) where.title = { [Op.iLike]: `%${search}%` };
  if (category_id) where.category_id = category_id;
  if (status === 'published') where.is_published = true;
  if (status === 'draft') where.is_published = false;
  if (display_filter === 'normal') where.is_normal = true;
  if (display_filter === 'highlight') where.is_highlight = true;
  if (display_filter === 'slider') where.is_slider = true;

  const { count, rows } = await NewsArticle.findAndCountAll({
    where,
    include: [
      { model: NewsCategory, as: 'category', attributes: ['id', 'name'] },
      { model: User, as: 'author', attributes: ['id', 'full_name'] },
    ],
    order: [['published_at', 'DESC NULLS LAST'], ['created_at', 'DESC']],
    limit,
    offset,
  });

  return paginatedResponse(res, rows, count, page, limit);
});

// GET /api/admin/news/:id
exports.getById = asyncHandler(async (req, res) => {
  const article = await NewsArticle.findByPk(req.params.id, {
    include: [
      { model: NewsCategory, as: 'category' },
      { model: User, as: 'author', attributes: ['id', 'full_name'] },
      { model: Department, as: 'department', attributes: ['id', 'name'] },
    ],
  });

  if (!article) throw new ApiError(404, 'News article not found');
  return successResponse(res, article);
});

// POST /api/admin/news
exports.create = asyncHandler(async (req, res) => {
  const { title, content, specifications, catalogue_blocks, thumbnail_url, image_urls, category_id, department_id,
          is_normal, is_highlight, is_slider, slider_sort_order, is_published } = req.body;

  const slug = slugify(title);

  // Check unique slug
  const existing = await NewsArticle.findOne({ where: { slug } });
  const finalSlug = existing ? `${slug}-${Date.now()}` : slug;

  const article = await NewsArticle.create({
    title,
    slug: finalSlug,
    content,
    specifications,
    catalogue_blocks,
    thumbnail_url,
    image_urls: normalizeImageUrls(image_urls),
    category_id,
    department_id,
    author_id: req.user.id,
    is_normal: is_normal !== undefined ? is_normal : true,
    is_highlight: is_highlight || false,
    is_slider: is_slider || false,
    slider_sort_order: slider_sort_order || 0,
    is_published: is_published || false,
    published_at: is_published ? new Date() : null,
  });

  return successResponse(res, article, 'News article created', 201);
});

// PUT /api/admin/news/:id
exports.update = asyncHandler(async (req, res) => {
  const article = await NewsArticle.findByPk(req.params.id);
  if (!article) throw new ApiError(404, 'News article not found');

  const { title, content, specifications, catalogue_blocks, thumbnail_url, image_urls, category_id, department_id,
          is_normal, is_highlight, is_slider, slider_sort_order, is_published } = req.body;

  // Update slug if title changed
  if (title && title !== article.title) {
    const newSlug = slugify(title);
    const existing = await NewsArticle.findOne({
      where: { slug: newSlug, id: { [Op.ne]: article.id } },
    });
    article.slug = existing ? `${newSlug}-${Date.now()}` : newSlug;
    article.title = title;
  }

  if (content !== undefined) article.content = content;
  if (specifications !== undefined) article.specifications = specifications;
  if (catalogue_blocks !== undefined) article.catalogue_blocks = catalogue_blocks;
  if (thumbnail_url !== undefined) article.thumbnail_url = thumbnail_url;
  if (image_urls !== undefined) article.image_urls = normalizeImageUrls(image_urls);
  if (category_id !== undefined) article.category_id = category_id;
  if (department_id !== undefined) article.department_id = department_id;
  if (is_normal !== undefined) article.is_normal = is_normal;
  if (is_highlight !== undefined) article.is_highlight = is_highlight;
  if (is_slider !== undefined) article.is_slider = is_slider;
  if (slider_sort_order !== undefined) article.slider_sort_order = slider_sort_order;
  if (is_published !== undefined) {
    article.is_published = is_published;
    if (is_published && !article.published_at) {
      article.published_at = new Date();
    }
  }

  await article.save();
  return successResponse(res, article, 'News article updated');
});

// DELETE /api/admin/news/:id
exports.remove = asyncHandler(async (req, res) => {
  const article = await NewsArticle.findByPk(req.params.id);
  if (!article) throw new ApiError(404, 'News article not found');

  await article.destroy();
  return successResponse(res, null, 'News article deleted');
});

// PATCH /api/admin/news/:id/toggle-publish
exports.togglePublish = asyncHandler(async (req, res) => {
  const article = await NewsArticle.findByPk(req.params.id);
  if (!article) throw new ApiError(404, 'News article not found');

  article.is_published = !article.is_published;
  if (article.is_published && !article.published_at) {
    article.published_at = new Date();
  }

  await article.save();
  return successResponse(res, article, `Article ${article.is_published ? 'published' : 'unpublished'}`);
});

// PATCH /api/admin/news/:id/toggle-pin
exports.togglePin = asyncHandler(async (req, res) => {
  const article = await NewsArticle.findByPk(req.params.id);
  if (!article) throw new ApiError(404, 'News article not found');

  article.is_pinned = !article.is_pinned;
  await article.save();

  return successResponse(res, article, `Article ${article.is_pinned ? 'pinned' : 'unpinned'}`);
});
