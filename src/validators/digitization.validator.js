const { body } = require('express-validator');

exports.createTemplateRules = [
  body('name').notEmpty().withMessage('Tên mẫu không được để trống').isLength({ max: 300 }).withMessage('Tên mẫu không được quá 300 ký tự'),
  body('template_type').notEmpty().withMessage('Loại mẫu không được để trống').isIn(['docx', 'xlsx']).withMessage('Loại mẫu phải là docx hoặc xlsx'),
  body('template_file_url').notEmpty().withMessage('Chưa tải lên file mẫu').isString(),
  body('questions').notEmpty().withMessage('Cần ít nhất 1 câu hỏi').isArray({ min: 1 }).withMessage('Cần ít nhất 1 câu hỏi'),
  body('questions.*.key').notEmpty().withMessage('Mã câu hỏi không được để trống'),
  body('questions.*.label').notEmpty().withMessage('Nhãn câu hỏi không được để trống'),
  body('questions.*.type').notEmpty().withMessage('Loại câu hỏi không được để trống').isIn(['text', 'number', 'float', 'date', 'time', 'select', 'textarea', 'radio', 'table', 'group', 'dynamic_table', 'computed', 'yes_no']).withMessage('Loại câu hỏi không hợp lệ'),
  body('questions.*.options').optional().isArray(),
  body('questions.*.columns').optional().isArray(),
  // Group: sub-questions inside a group
  body('questions.*.children').optional().isArray(),
  body('questions.*.children.*.key').optional().notEmpty().withMessage('Mã câu hỏi con không được để trống'),
  body('questions.*.children.*.label').optional().notEmpty().withMessage('Nhãn câu hỏi con không được để trống'),
  body('questions.*.children.*.type').optional().isIn(['text', 'number', 'float', 'date', 'time', 'select', 'textarea', 'radio', 'table', 'computed', 'dynamic_table', 'yes_no']).withMessage('Loại câu hỏi con không hợp lệ'),
  body('questions.*.children.*.options').optional().isArray(),
  body('questions.*.children.*.columns').optional().isArray(),
  body('questions.*.children.*.placeholder').optional().isString(),
  body('questions.*.children.*.required').optional().isBoolean(),
  body('questions.*.children.*.defaultValue').optional(),
  // Dynamic table fields for children
  body('questions.*.children.*.triggerKey').optional().isString(),
  body('questions.*.children.*.tableColumns').optional().isArray(),
  body('questions.*.children.*.tableColumns.*.key').optional().notEmpty().withMessage('Mã cột bảng không được để trống'),
  body('questions.*.children.*.tableColumns.*.label').optional().notEmpty().withMessage('Nhãn cột bảng không được để trống'),
  body('questions.*.children.*.tableColumns.*.type')
    .optional()
    .isIn(['text', 'number', 'radio', 'select', 'float', 'textarea'])
    .withMessage('Loại cột bảng không hợp lệ'),
  body('questions.*.children.*.tableColumns.*.options').optional().isArray(),
  // Dynamic table: number triggers a table with N rows
  body('questions.*.triggerKey').optional().isString(),
  body('questions.*.tableColumns').optional().isArray(),
  body('questions.*.tableColumns.*.key').optional().notEmpty().withMessage('Mã cột bảng không được để trống'),
  body('questions.*.tableColumns.*.label').optional().notEmpty().withMessage('Nhãn cột bảng không được để trống'),
  body('questions.*.tableColumns.*.type')
    .optional()
    .isIn(['text', 'number', 'radio', 'select', 'float', 'textarea'])
    .withMessage('Loại cột bảng không hợp lệ'),
  body('questions.*.tableColumns').optional().isArray(),
  // Ref: reference data from another question's table
  body('questions.*.refKey').optional().isString(),
  body('questions.*.refColumns').optional().isArray(),
  // Computed: auto-calculate from other fields
  body('questions.*.formula').optional().isString(),
  body('questions.*.formulaDeps').optional().isArray(),
  // Default value
  body('questions.*.defaultValue').optional(),
  // Blank mapping (array of blank indices — one question can fill multiple blanks)
  body('questions.*.blankIndices').optional({ nullable: true }).isArray(),
  body('questions.*.blankIndices.*').optional().isInt(),
  body('questions.*.children.*.blankIndices').optional({ nullable: true }).isArray(),
  body('questions.*.children.*.blankIndices.*').optional().isInt(),
  // Legacy single blankIndex (backward compat)
  body('questions.*.blankIndex').optional({ nullable: true }).isInt(),
  body('questions.*.children.*.blankIndex').optional({ nullable: true }).isInt(),
  // Fill rule: how to process value before filling blanks
  body('questions.*.fillRule').optional({ nullable: true }),
  body('questions.*.children.*.fillRule').optional({ nullable: true }),
  // Dynamic table blank mapping: { colKey: [blankIdx_row0, blankIdx_row1, ...] }
  body('questions.*.blankMapping').optional({ nullable: true }),
  body('questions.*.children.*.blankMapping').optional({ nullable: true }),
  // Row pattern: auto-expand dynamic table rows
  body('questions.*.rowPattern').optional({ nullable: true }),
  body('questions.*.rowPattern.templateRows').optional().isInt({ min: 1 }),
  body('questions.*.rowPattern.blanksPerRow').optional().isInt({ min: 1 }),
  body('questions.*.rowPattern.startBlank').optional().isInt({ min: -1 }),
  body('questions.*.rowPattern.columnOrder').optional().isArray(),
  body('questions.*.children.*.rowPattern').optional({ nullable: true }),
  body('questions.*.children.*.rowPattern.templateRows').optional().isInt({ min: 1 }),
  body('questions.*.children.*.rowPattern.blanksPerRow').optional().isInt({ min: 1 }),
  body('questions.*.children.*.rowPattern.startBlank').optional().isInt({ min: -1 }),
  body('questions.*.children.*.rowPattern.columnOrder').optional().isArray(),
  body('blanks').optional({ nullable: true }).isArray(),
  body('blanks.*.index').optional().isInt(),
  body('blanks.*.label').optional().isString(),
  body('blanks.*.context').optional().isString(),
  body('description').optional().isString(),
  body('category').optional().isString().isLength({ max: 100 }),
  body('icon').optional().isString().isLength({ max: 50 }),
  body('sort_order').optional().isInt(),
  body('is_active').optional().isBoolean(),
  body('department_id').optional({ nullable: true }).isInt(),
];

exports.updateTemplateRules = [
  body('name').optional().isLength({ max: 300 }),
  body('template_type').optional().isIn(['docx', 'xlsx']),
  body('template_file_url').optional().isString(),
  body('questions').optional().isArray(),
  body('blanks').optional({ nullable: true }).isArray(),
  body('description').optional().isString(),
  body('category').optional().isString().isLength({ max: 100 }),
  body('icon').optional().isString().isLength({ max: 50 }),
  body('sort_order').optional().isInt(),
  body('is_active').optional().isBoolean(),
  body('department_id').optional({ nullable: true }).isInt(),
];

exports.submitFormRules = [
  body('answers').notEmpty().withMessage('Chưa có câu trả lời nào').isObject(),
];
