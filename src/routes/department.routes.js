const router = require('express').Router();
const controller = require('../controllers/department.controller');
const { createDepartmentRules, updateDepartmentRules, createSubMenuRules } = require('../validators/department.validator');
const { validate } = require('../middleware/validate');
const { authorize } = require('../middleware/roleCheck');

router.get('/', controller.getAll);
router.get('/:id', controller.getById);
router.post('/', authorize('admin'), createDepartmentRules, validate, controller.create);
router.put('/:id', authorize('admin'), updateDepartmentRules, validate, controller.update);
router.delete('/:id', authorize('admin'), controller.remove);

// Sub-menu items
router.get('/:departmentId/sub-menus', controller.getSubMenus);
router.post('/:departmentId/sub-menus', authorize('admin'), createSubMenuRules, validate, controller.createSubMenu);

module.exports = router;
