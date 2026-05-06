const { body } = require('express-validator');

exports.createUserRules = [
  body('employee_code').notEmpty().withMessage('Employee code is required'),
  body('full_name').notEmpty().withMessage('Full name is required'),
  body('email').notEmpty().isEmail().withMessage('Valid email is required'),
  body('password').notEmpty().isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('role').optional().isIn(['admin', 'editor', 'viewer']),
  body('department_id').optional().isInt(),
  body('position').optional().isString(),
];

exports.updateUserRules = [
  body('full_name').optional().isString(),
  body('email').optional().isEmail(),
  body('role').optional().isIn(['admin', 'editor', 'viewer']),
  body('department_id').optional().isInt({ allow_leading_zeroes: false }),
  body('position').optional().isString(),
  body('is_active').optional().isBoolean(),
];
