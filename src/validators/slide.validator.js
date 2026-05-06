const { body } = require('express-validator');

exports.createSlideRules = [
  body('title').notEmpty().withMessage('Title is required').isLength({ max: 200 }),
  body('image_url').notEmpty().withMessage('Image URL is required'),
  body('link_url').optional().isString(),
  body('color').optional().matches(/^#[0-9a-fA-F]{6}$/),
  body('sort_order').optional().isInt(),
  body('start_date').optional().isDate(),
  body('end_date').optional().isDate(),
];

exports.updateSlideRules = [
  body('title').optional().isLength({ max: 200 }),
  body('image_url').optional().isString(),
  body('link_url').optional().isString(),
  body('color').optional().matches(/^#[0-9a-fA-F]{6}$/),
  body('sort_order').optional().isInt(),
  body('is_active').optional().isBoolean(),
  body('start_date').optional().isDate(),
  body('end_date').optional().isDate(),
];
