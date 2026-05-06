const { body } = require('express-validator');

exports.createPositionRules = [
  body('name').notEmpty().withMessage('Tên chức vụ không được để trống'),
  body('code').notEmpty().withMessage('Mã chức vụ không được để trống'),
  body('level').optional().isInt({ min: 1, max: 10 }),
  body('description').optional().isString(),
];

exports.updatePositionRules = [
  body('name').optional().isString(),
  body('code').optional().isString(),
  body('level').optional().isInt({ min: 1, max: 10 }),
  body('description').optional().isString(),
  body('is_active').optional().isBoolean(),
];
