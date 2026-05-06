const bcrypt = require('bcryptjs');
const { User, Department } = require('../models');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { successResponse, paginatedResponse } = require('../utils/response');
const { parsePagination } = require('../utils/pagination');

// GET /api/admin/users
exports.getAll = asyncHandler(async (req, res) => {
  const { page, limit, offset } = parsePagination(req.query);
  const { role, department_id } = req.query;

  const where = {};
  if (role) where.role = role;
  if (department_id) where.department_id = department_id;

  const { count, rows } = await User.findAndCountAll({
    where,
    include: [{ model: Department, as: 'department', attributes: ['id', 'name'] }],
    order: [['created_at', 'DESC']],
    limit,
    offset,
  });

  return paginatedResponse(res, rows, count, page, limit);
});

// GET /api/admin/users/:id
exports.getById = asyncHandler(async (req, res) => {
  const user = await User.findByPk(req.params.id, {
    include: [{ model: Department, as: 'department' }],
  });
  if (!user) throw new ApiError(404, 'User not found');
  return successResponse(res, user);
});

// POST /api/admin/users
exports.create = asyncHandler(async (req, res) => {
  const { employee_code, full_name, email, password, role, department_id, position } = req.body;

  const salt = await bcrypt.genSalt(10);
  const password_hash = await bcrypt.hash(password, salt);

  const user = await User.create({
    employee_code, full_name, email, password_hash,
    role: role || 'viewer', department_id, position,
  });

  // Return without password_hash
  const userData = await User.findByPk(user.id);
  return successResponse(res, userData, 'User created', 201);
});

// PUT /api/admin/users/:id
exports.update = asyncHandler(async (req, res) => {
  const user = await User.findByPk(req.params.id);
  if (!user) throw new ApiError(404, 'User not found');

  const { full_name, email, role, department_id, position, is_active } = req.body;
  if (full_name !== undefined) user.full_name = full_name;
  if (email !== undefined) user.email = email;
  if (role !== undefined) user.role = role;
  if (department_id !== undefined) user.department_id = department_id;
  if (position !== undefined) user.position = position;
  if (is_active !== undefined) user.is_active = is_active;

  await user.save();
  return successResponse(res, user, 'User updated');
});

// DELETE /api/admin/users/:id (soft delete - deactivate)
exports.remove = asyncHandler(async (req, res) => {
  const user = await User.findByPk(req.params.id);
  if (!user) throw new ApiError(404, 'User not found');

  user.is_active = false;
  await user.save();
  return successResponse(res, null, 'User deactivated');
});

// PUT /api/admin/users/:id/reset-password
exports.resetPassword = asyncHandler(async (req, res) => {
  const user = await User.scope('withPassword').findByPk(req.params.id);
  if (!user) throw new ApiError(404, 'User not found');

  const salt = await bcrypt.genSalt(10);
  user.password_hash = await bcrypt.hash('123456', salt);
  await user.save();

  return successResponse(res, null, 'Password reset to default (123456)');
});
