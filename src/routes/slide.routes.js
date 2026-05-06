const router = require('express').Router();
const controller = require('../controllers/slide.controller');
const { createSlideRules, updateSlideRules } = require('../validators/slide.validator');
const { validate } = require('../middleware/validate');
const { authorize } = require('../middleware/roleCheck');

router.get('/', controller.getAll);
router.post('/', authorize('admin', 'editor'), createSlideRules, validate, controller.create);
router.put('/:id', authorize('admin', 'editor'), updateSlideRules, validate, controller.update);
router.delete('/:id', authorize('admin'), controller.remove);

module.exports = router;
