const { body } = require('express-validator');

exports.createContractRules = [
  body('employee_id').notEmpty().isInt().withMessage('Mã nhân viên không hợp lệ'),
  body('contract_number').notEmpty().withMessage('Số hợp đồng không được để trống'),
  body('contract_type').notEmpty().isIn(['probation', 'fixed_term', 'indefinite']).withMessage('Loại hợp đồng không hợp lệ'),
  body('start_date').notEmpty().isDate().withMessage('Ngày bắt đầu không hợp lệ'),
  body('end_date').optional({ nullable: true }).isDate(),
  body('base_salary').notEmpty().isDecimal().withMessage('Lương cơ bản không hợp lệ'),
  body('notes').optional().isString(),
];

exports.updateContractRules = [
  body('contract_number').optional().isString(),
  body('contract_type').optional().isIn(['probation', 'fixed_term', 'indefinite']),
  body('start_date').optional().isDate(),
  body('end_date').optional({ nullable: true }).isDate(),
  body('base_salary').optional().isDecimal(),
  body('status').optional().isIn(['active', 'expired', 'terminated']),
  body('notes').optional().isString(),
];
