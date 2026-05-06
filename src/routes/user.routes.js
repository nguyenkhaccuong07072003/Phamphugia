const router = require('express').Router();
const controller = require('../controllers/user.controller');
const { createUserRules, updateUserRules } = require('../validators/user.validator');
const { validate } = require('../middleware/validate');

router.get('/', controller.getAll);
router.get('/:id', controller.getById);
router.post('/', createUserRules, validate, controller.create);
router.put('/:id', updateUserRules, validate, controller.update);
router.delete('/:id', controller.remove);
router.put('/:id/reset-password', controller.resetPassword);

module.exports = router;
