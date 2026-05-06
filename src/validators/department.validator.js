const { body } = require('express-validator');

exports.createDepartmentRules = [
  body('name').notEmpty().withMessage('Name is required').isLength({ max: 200 }),
  body('phone').optional().isString(),
  body('sort_order').optional().isInt(),
];

exports.updateDepartmentRules = [
  body('name').optional().isLength({ max: 200 }),
  body('phone').optional().isString(),
  body('sort_order').optional().isInt(),
  body('is_active').optional().isBoolean(),
];

exports.createSubMenuRules = [
  body('label').notEmpty().withMessage('Label is required').isLength({ max: 150 }),
  body('href').optional().isString(),
  body('sort_order').optional().isInt(),
  body('content').optional().isString(),
  body('parent_id').optional({ nullable: true }).isInt(),
];
