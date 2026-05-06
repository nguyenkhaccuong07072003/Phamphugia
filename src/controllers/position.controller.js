const { Position, Employee } = require('../models');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { successResponse, paginatedResponse } = require('../utils/response');
const { parsePagination } = require('../utils/pagination');

// GET /api/admin/positions
exports.getAll = asyncHandler(async (req, res) => {
  const { all } = req.query;

  // Nếu all=true, trả về tất cả (cho dropdown)
  if (all === 'true') {
    const positions = await Position.findAll({
      where: { is_active: true },
      order: [['level', 'ASC'], ['name', 'ASC']],
    });
    return successResponse(res, positions);
  }

  const { page, limit, offset } = parsePagination(req.query);
  const { count, rows } = await Position.findAndCountAll({
    order: [['level', 'ASC'], ['name', 'ASC']],
    limit,
    offset,
  });
  return paginatedResponse(res, rows, count, page, limit);
});

// GET /api/admin/positions/:id
exports.getById = asyncHandler(async (req, res) => {
  const position = await Position.findByPk(req.params.id, {
    include: [{ model: Employee, as: 'employees', attributes: ['id', 'full_name', 'employee_code'] }],
  });
  if (!position) throw new ApiError(404, 'Không tìm thấy chức vụ');
  return successResponse(res, position);
});

// POST /api/admin/positions
exports.create = asyncHandler(async (req, res) => {
  const existing = await Position.findOne({ where: { code: req.body.code } });
  if (existing) throw new ApiError(409, 'Mã chức vụ đã tồn tại');

  const position = await Position.create(req.body);
  return successResponse(res, position, 'Tạo chức vụ thành công', 201);
});

// PUT /api/admin/positions/:id
exports.update = asyncHandler(async (req, res) => {
  const position = await Position.findByPk(req.params.id);
  if (!position) throw new ApiError(404, 'Không tìm thấy chức vụ');

  await position.update(req.body);
  return successResponse(res, position, 'Cập nhật chức vụ thành công');
});

// DELETE /api/admin/positions/:id
exports.remove = asyncHandler(async (req, res) => {
  const position = await Position.findByPk(req.params.id);
  if (!position) throw new ApiError(404, 'Không tìm thấy chức vụ');

  const employeeCount = await Employee.count({ where: { position_id: position.id } });
  if (employeeCount > 0) {
    throw new ApiError(400, `Không thể xóa. Có ${employeeCount} nhân viên đang giữ chức vụ này`);
  }

  await position.destroy();
  return successResponse(res, null, 'Xóa chức vụ thành công');
});
