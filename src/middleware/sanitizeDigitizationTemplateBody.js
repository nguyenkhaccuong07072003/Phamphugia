/**
 * Xóa `questions[].children` khi `type !== 'group'`.
 * Tránh lỗi validate (nhãn câu hỏi con rỗng) khi người dùng từng chọn "Nhóm câu hỏi" rồi đổi sang loại khác mà payload còn sót `children`.
 */
function sanitizeDigitizationTemplateBody(req, _res, next) {
  const questions = req.body?.questions;
  if (!Array.isArray(questions)) return next();
  for (const q of questions) {
    if (q && q.type !== 'group') {
      delete q.children;
    }
  }
  next();
}

module.exports = { sanitizeDigitizationTemplateBody };
