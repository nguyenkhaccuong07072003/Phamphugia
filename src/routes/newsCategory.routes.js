const router = require('express').Router();
const controller = require('../controllers/newsCategory.controller');
const { authorize } = require('../middleware/roleCheck');

router.get('/', controller.getAll);
router.post('/', authorize('admin'), controller.create);
router.put('/:id', authorize('admin'), controller.update);
router.delete('/:id', authorize('admin'), controller.remove);

module.exports = router;
