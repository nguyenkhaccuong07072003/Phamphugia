const { body } = require('express-validator');

exports.createNewsRules = [
  body('title').notEmpty().withMessage('Title is required').isLength({ max: 300 }),
  body('category_id').notEmpty().withMessage('Category is required').isInt(),
  body('is_highlight').optional().isBoolean(),
  body('is_slider').optional().isBoolean(),
  body('slider_sort_order').optional().isInt(),
  body('content').optional().isString(),
  body('specifications').optional({ nullable: true }).isString(),
  body('catalogue_blocks').optional().isArray(),
  body('catalogue_blocks.*.id').optional().isString(),
  body('catalogue_blocks.*.title').optional().isString(),
  body('catalogue_blocks.*.image').optional({ nullable: true }).isString(),
  body('catalogue_blocks.*.specifications').optional({ nullable: true }).isString(),
  body('thumbnail_url').optional({ nullable: true }).isString(),
  body('image_urls').optional().isArray(),
  body('image_urls.*').optional().isString(),

  body('is_published').optional().isBoolean(),
];

exports.updateNewsRules = [
  body('title').optional().isLength({ max: 300 }),
  body('category_id').optional().isInt(),
  body('is_highlight').optional().isBoolean(),
  body('is_slider').optional().isBoolean(),
  body('slider_sort_order').optional().isInt(),
  body('content').optional().isString(),
  body('specifications').optional({ nullable: true }).isString(),
  body('catalogue_blocks').optional().isArray(),
  body('catalogue_blocks.*.id').optional().isString(),
  body('catalogue_blocks.*.title').optional().isString(),
  body('catalogue_blocks.*.image').optional({ nullable: true }).isString(),
  body('catalogue_blocks.*.specifications').optional({ nullable: true }).isString(),
  body('thumbnail_url').optional({ nullable: true }).isString(),
  body('image_urls').optional().isArray(),
  body('image_urls.*').optional().isString(),

  body('is_published').optional().isBoolean(),
];
