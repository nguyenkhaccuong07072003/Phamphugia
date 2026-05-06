const router = require('express').Router();
const controller = require('../controllers/file.controller');
const upload = require('../config/upload');
const { authorize } = require('../middleware/roleCheck');

router.post('/upload', authorize('admin', 'editor'), upload.single('file'), controller.upload);
router.post('/upload-multiple', authorize('admin', 'editor'), upload.array('files', 10), controller.uploadMultiple);
router.get('/', controller.getAll);
router.delete('/:id', authorize('admin'), controller.remove);

module.exports = router;
