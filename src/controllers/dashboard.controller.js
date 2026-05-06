const { NewsArticle, Slide, Banner, NewsCategory, sequelize } = require('../models');
const { QueryTypes } = require('sequelize');
const asyncHandler = require('../utils/asyncHandler');
const { successResponse } = require('../utils/response');

// GET /api/admin/dashboard/stats
exports.getStats = asyncHandler(async (req, res) => {
  const [countsRows, recentNews] = await Promise.all([
    sequelize.query(
      `SELECT
        (SELECT COUNT(*)::integer FROM news_articles) AS "totalNews",
        (SELECT COUNT(*)::integer FROM slides WHERE is_active = true) AS "totalSlides",
        (SELECT COUNT(*)::integer FROM banner WHERE is_active = true) AS "totalBanners",
        (SELECT COUNT(*)::integer FROM users WHERE is_active = true) AS "totalUsers"`,
      { type: QueryTypes.SELECT },
    ),
    NewsArticle.findAll({
      attributes: ['id', 'title', 'is_published', 'created_at'],
      include: [{ model: NewsCategory, as: 'category', attributes: ['name'] }],
      order: [['created_at', 'DESC']],
      limit: 5,
    }),
  ]);

  const c = countsRows[0] || {};
  return successResponse(res, {
    stats: {
      totalNews: c.totalNews ?? 0,
      totalSlides: c.totalSlides ?? 0,
      totalBanners: c.totalBanners ?? 0,
      totalUsers: c.totalUsers ?? 0,
    },
    recentNews,
  });
});
