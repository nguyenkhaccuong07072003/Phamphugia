const { Attendance, Employee, Department } = require('../models');
const { Op } = require('sequelize');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { successResponse, paginatedResponse } = require('../utils/response');
const { parsePagination } = require('../utils/pagination');

// GET /api/admin/attendance
exports.getAll = asyncHandler(async (req, res) => {
  const { page, limit, offset } = parsePagination(req.query);
  const { employee_id, department_id, date, month, year, status } = req.query;

  const where = {};
  if (employee_id) where.employee_id = employee_id;
  if (status) where.status = status;
  if (date) {
    where.date = date;
  } else if (month && year) {
    const startDate = `${year}-${month.padStart(2, '0')}-01`;
    const endMonth = parseInt(month);
    const endYear = parseInt(year);
    const lastDay = new Date(endYear, endMonth, 0).getDate();
    const endDate = `${year}-${month.padStart(2, '0')}-${lastDay}`;
    where.date = { [Op.between]: [startDate, endDate] };
  }

  const includeOpts = [
    { model: Employee, as: 'employee', attributes: ['id', 'full_name', 'employee_code', 'department_id'] },
  ];

  // Lọc theo phòng ban qua employee
  if (department_id) {
    includeOpts[0].where = { department_id };
    includeOpts[0].required = true;
  }

  const { count, rows } = await Attendance.findAndCountAll({
    where,
    include: includeOpts,
    order: [['date', 'DESC'], ['employee_id', 'ASC']],
    limit,
    offset,
  });
  return paginatedResponse(res, rows, count, page, limit);
});

// POST /api/admin/attendance (tạo hoặc cập nhật chấm công)
exports.createOrUpdate = asyncHandler(async (req, res) => {
  const { employee_id, date, check_in, check_out, status, overtime_hours, notes } = req.body;

  const employee = await Employee.findByPk(employee_id);
  if (!employee) throw new ApiError(404, 'Không tìm thấy nhân viên');

  // Tính số giờ làm việc
  let work_hours = null;
  if (check_in && check_out) {
    const [inH, inM] = check_in.split(':').map(Number);
    const [outH, outM] = check_out.split(':').map(Number);
    work_hours = Math.max(0, (outH + outM / 60) - (inH + inM / 60) - 1); // Trừ 1 giờ nghỉ trưa
  }

  const [attendance, created] = await Attendance.upsert({
    employee_id,
    date,
    check_in,
    check_out,
    status: status || 'present',
    work_hours,
    overtime_hours: overtime_hours || 0,
    notes,
  }, {
    conflictFields: ['employee_id', 'date'],
  });

  const result = await Attendance.findByPk(attendance.id, {
    include: [{ model: Employee, as: 'employee', attributes: ['id', 'full_name', 'employee_code'] }],
  });

  return successResponse(res, result, created ? 'Tạo chấm công thành công' : 'Cập nhật chấm công thành công', created ? 201 : 200);
});

// POST /api/admin/attendance/batch - Chấm công hàng loạt
exports.batchCreate = asyncHandler(async (req, res) => {
  const { date, records } = req.body;
  // records: [{ employee_id, check_in, check_out, status, notes }]

  if (!date || !records || !Array.isArray(records)) {
    throw new ApiError(400, 'Dữ liệu không hợp lệ');
  }

  const results = [];
  for (const record of records) {
    let work_hours = null;
    if (record.check_in && record.check_out) {
      const [inH, inM] = record.check_in.split(':').map(Number);
      const [outH, outM] = record.check_out.split(':').map(Number);
      work_hours = Math.max(0, (outH + outM / 60) - (inH + inM / 60) - 1);
    }

    const [attendance] = await Attendance.upsert({
      employee_id: record.employee_id,
      date,
      check_in: record.check_in,
      check_out: record.check_out,
      status: record.status || 'present',
      work_hours,
      overtime_hours: record.overtime_hours || 0,
      notes: record.notes,
    }, {
      conflictFields: ['employee_id', 'date'],
    });
    results.push(attendance);
  }

  return successResponse(res, results, `Đã chấm công ${results.length} nhân viên`);
});

// GET /api/admin/attendance/summary - Tổng hợp chấm công tháng
exports.getSummary = asyncHandler(async (req, res) => {
  const { month, year, department_id } = req.query;
  if (!month || !year) throw new ApiError(400, 'Vui lòng chọn tháng và năm');

  const startDate = `${year}-${month.padStart(2, '0')}-01`;
  const lastDay = new Date(parseInt(year), parseInt(month), 0).getDate();
  const endDate = `${year}-${month.padStart(2, '0')}-${lastDay}`;

  const employeeWhere = { status: 'active' };
  if (department_id) employeeWhere.department_id = department_id;

  const employees = await Employee.findAll({
    where: employeeWhere,
    attributes: ['id', 'full_name', 'employee_code', 'department_id'],
    include: [
      { model: Department, as: 'department', attributes: ['id', 'name'] },
      {
        model: Attendance,
        as: 'attendances',
        where: { date: { [Op.between]: [startDate, endDate] } },
        required: false,
      },
    ],
    order: [['full_name', 'ASC']],
  });

  const summary = employees.map(emp => {
    const attendances = emp.attendances || [];
    return {
      employee_id: emp.id,
      full_name: emp.full_name,
      employee_code: emp.employee_code,
      department: emp.department,
      total_days: lastDay,
      present: attendances.filter(a => a.status === 'present').length,
      late: attendances.filter(a => a.status === 'late').length,
      absent: attendances.filter(a => a.status === 'absent').length,
      on_leave: attendances.filter(a => a.status === 'on_leave').length,
      half_day: attendances.filter(a => a.status === 'half_day').length,
      business_trip: attendances.filter(a => a.status === 'business_trip').length,
      remote: attendances.filter(a => a.status === 'remote').length,
      total_work_hours: attendances.reduce((sum, a) => sum + (parseFloat(a.work_hours) || 0), 0),
      total_overtime: attendances.reduce((sum, a) => sum + (parseFloat(a.overtime_hours) || 0), 0),
    };
  });

  return successResponse(res, summary);
});

// DELETE /api/admin/attendance/:id
exports.remove = asyncHandler(async (req, res) => {
  const attendance = await Attendance.findByPk(req.params.id);
  if (!attendance) throw new ApiError(404, 'Không tìm thấy bản ghi chấm công');

  await attendance.destroy();
  return successResponse(res, null, 'Xóa chấm công thành công');
});
