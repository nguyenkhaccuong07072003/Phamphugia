const router = require('express').Router();
const controller = require('../controllers/newsArticle.controller');
const { createNewsRules, updateNewsRules } = require('../validators/news.validator');
const { validate } = require('../middleware/validate');
const { authorize } = require('../middleware/roleCheck');

router.get('/', controller.getAll);
router.get('/:id', controller.getById);
router.post('/', authorize('admin', 'editor'), createNewsRules, validate, controller.create);
router.put('/:id', authorize('admin', 'editor'), updateNewsRules, validate, controller.update);
router.delete('/:id', authorize('admin'), controller.remove);
router.patch('/:id/toggle-publish', authorize('admin', 'editor'), controller.togglePublish);
router.patch('/:id/toggle-pin', authorize('admin'), controller.togglePin);

module.exports = router;
