const router = require('express').Router();
const controller = require('../controllers/siteSetting.controller');

router.get('/', controller.getAll);
router.post('/', controller.create);
router.put('/:key', controller.updateByKey);

module.exports = router;
