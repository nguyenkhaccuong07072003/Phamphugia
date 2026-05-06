const { validationResult } = require('express-validator');

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const mapped = errors.array().map(err => ({
      field: err.path,
      message: err.msg,
      value: err.value,
    }));
    console.log('[Validation failed]', JSON.stringify(mapped, null, 2));
    return res.status(400).json({
      success: false,
      message: 'Dữ liệu không hợp lệ',
      errors: mapped,
    });
  }
  next();
};

module.exports = { validate };
