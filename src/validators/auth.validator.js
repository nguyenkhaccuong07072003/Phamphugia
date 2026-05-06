const { body } = require('express-validator');

exports.loginRules = [
  body('email')
    .notEmpty()
    .withMessage('Vui lòng nhập email.')
    .isEmail()
    .withMessage('Email không đúng định dạng.'),
  body('password').notEmpty().withMessage('Vui lòng nhập mật khẩu.'),
];

exports.changePasswordRules = [
  body('currentPassword').notEmpty().withMessage('Vui lòng nhập mật khẩu hiện tại.'),
  body('newPassword')
    .notEmpty()
    .withMessage('Vui lòng nhập mật khẩu mới.')
    .isLength({ min: 6 })
    .withMessage('Mật khẩu mới phải có ít nhất 6 ký tự.'),
];
