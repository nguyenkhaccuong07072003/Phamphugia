const router = require('express').Router();
const controller = require('../controllers/position.controller');
const { createPositionRules, updatePositionRules } = require('../validators/position.validator');
const { validate } = require('../middleware/validate');

router.get('/', controller.getAll);
router.get('/:id', controller.getById);
router.post('/', createPositionRules, validate, controller.create);
router.put('/:id', updatePositionRules, validate, controller.update);
router.delete('/:id', controller.remove);

module.exports = router;
