const router = require('express').Router();
const controller = require('../controllers/visitorsLog.controller');
const { authorize } = require('../middleware/roleCheck');

router.get('/', authorize('admin'), controller.getAll);
router.get('/stats', authorize('admin'), controller.getStats);

module.exports = router;
