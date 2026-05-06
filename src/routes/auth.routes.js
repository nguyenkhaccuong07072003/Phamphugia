const router = require('express').Router();
const authController = require('../controllers/auth.controller');
const { loginRules, changePasswordRules } = require('../validators/auth.validator');
const { validate } = require('../middleware/validate');
const { authenticate } = require('../middleware/auth');

router.post('/login', loginRules, validate, authController.login);
router.post('/refresh', authController.refresh);
router.get('/me', authenticate, authController.getMe);
router.put('/change-password', authenticate, changePasswordRules, validate, authController.changePassword);

module.exports = router;
