const router = require('express').Router();
const controller = require('../controllers/digitization.controller');
const { createTemplateRules, updateTemplateRules, submitFormRules } = require('../validators/digitization.validator');
const { validate } = require('../middleware/validate');
const { authorize } = require('../middleware/roleCheck');
const { sanitizeDigitizationTemplateBody } = require('../middleware/sanitizeDigitizationTemplateBody');

// Submissions (authenticated user)
router.post('/submit/:templateId', submitFormRules, validate, controller.submitForm);
router.get('/submissions', controller.getMySubmissions);
router.get('/submissions/:id', controller.getSubmissionById);
router.get('/submissions/:id/download', controller.downloadSubmission);
router.get('/submissions/:id/print', controller.printSubmission);
router.delete('/submissions/:id', controller.deleteSubmission);

// Parse placeholders from uploaded template file
router.post('/parse-placeholders', authorize('admin', 'editor'), controller.parsePlaceholders);

// Templates CRUD (admin)
router.get('/templates', controller.getAllTemplates);
router.post(
  '/templates',
  authorize('admin', 'editor'),
  sanitizeDigitizationTemplateBody,
  createTemplateRules,
  validate,
  controller.createTemplate,
);
router.put(
  '/templates/:id',
  authorize('admin', 'editor'),
  sanitizeDigitizationTemplateBody,
  updateTemplateRules,
  validate,
  controller.updateTemplate,
);
router.delete('/templates/:id', authorize('admin'), controller.deleteTemplate);

module.exports = router;
