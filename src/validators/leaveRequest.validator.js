const { body } = require('express-validator');

exports.createLeaveRequestRules = [
  body('employee_id').notEmpty().isInt().withMessage('Mã nhân viên không hợp lệ'),
  body('leave_type').notEmpty().isIn(['annual', 'sick', 'maternity', 'wedding', 'funeral', 'unpaid', 'other']).withMessage('Loại nghỉ phép không hợp lệ'),
  body('start_date').notEmpty().isDate().withMessage('Ngày bắt đầu không hợp lệ'),
  body('end_date').notEmpty().isDate().withMessage('Ngày kết thúc không hợp lệ'),
  body('total_days').notEmpty().isDecimal().withMessage('Số ngày nghỉ không hợp lệ'),
  body('reason').notEmpty().withMessage('Lý do không được để trống'),
];

exports.updateLeaveRequestRules = [
  body('status').optional().isIn(['pending', 'approved', 'rejected', 'cancelled']),
  body('reject_reason').optional().isString(),
];
