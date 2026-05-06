const router = require('express').Router();
const controller = require('../controllers/department.controller');
const { authorize } = require('../middleware/roleCheck');

router.put('/:id', authorize('admin'), controller.updateSubMenu);
router.delete('/:id', authorize('admin'), controller.removeSubMenu);

module.exports = router;
