const { VisitorsLog, sequelize } = require('../models');
const { Op } = require('sequelize');
const asyncHandler = require('../utils/asyncHandler');
const { successResponse, paginatedResponse } = require('../utils/response');
const { parsePagination } = require('../utils/pagination');

// GET /api/admin/visitors
exports.getAll = asyncHandler(async (req, res) => {
  const { page, limit, offset } = parsePagination(req.query);
  const { from, to } = req.query;

  const where = {};
  if (from || to) {
    where.visited_at = {};
    if (from) where.visited_at[Op.gte] = new Date(from);
    if (to) where.visited_at[Op.lte] = new Date(to);
  }

  const { count, rows } = await VisitorsLog.findAndCountAll({
    where,
    order: [['visited_at', 'DESC']],
    limit,
    offset,
  });

  return paginatedResponse(res, rows, count, page, limit);
});

// GET /api/admin/visitors/stats
exports.getStats = asyncHandler(async (req, res) => {
  const today = new Date();
  const startOfDay = new Date(today.setHours(0, 0, 0, 0));
  const startOfWeek = new Date(today);
  startOfWeek.setDate(startOfWeek.getDate() - 7);
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

  const [todayCount, weekCount, monthCount, totalCount] = await Promise.all([
    VisitorsLog.count({ where: { visited_at: { [Op.gte]: startOfDay } } }),
    VisitorsLog.count({ where: { visited_at: { [Op.gte]: startOfWeek } } }),
    VisitorsLog.count({ where: { visited_at: { [Op.gte]: startOfMonth } } }),
    VisitorsLog.count(),
  ]);

  return successResponse(res, { todayCount, weekCount, monthCount, totalCount });
});
