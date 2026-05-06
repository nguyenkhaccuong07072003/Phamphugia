const { body } = require('express-validator');

exports.createAttendanceRules = [
  body('employee_id').notEmpty().isInt().withMessage('Mã nhân viên không hợp lệ'),
  body('date').notEmpty().isDate().withMessage('Ngày không hợp lệ'),
  body('check_in').optional().matches(/^\d{2}:\d{2}(:\d{2})?$/).withMessage('Giờ vào không hợp lệ (HH:MM)'),
  body('check_out').optional().matches(/^\d{2}:\d{2}(:\d{2})?$/).withMessage('Giờ ra không hợp lệ (HH:MM)'),
  body('status').optional().isIn(['present', 'absent', 'late', 'half_day', 'on_leave', 'business_trip', 'remote']),
  body('overtime_hours').optional().isDecimal(),
  body('notes').optional().isString(),
];

exports.updateAttendanceRules = [
  body('check_in').optional().matches(/^\d{2}:\d{2}(:\d{2})?$/),
  body('check_out').optional().matches(/^\d{2}:\d{2}(:\d{2})?$/),
  body('status').optional().isIn(['present', 'absent', 'late', 'half_day', 'on_leave', 'business_trip', 'remote']),
  body('work_hours').optional().isDecimal(),
  body('overtime_hours').optional().isDecimal(),
  body('notes').optional().isString(),
];
