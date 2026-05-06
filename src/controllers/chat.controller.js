const { GoogleGenerativeAI } = require("@google/generative-ai");
const asyncHandler = require("../utils/asyncHandler");
const { successResponse } = require("../utils/response");
const ApiError = require("../utils/ApiError");

const SYSTEM_PROMPT =
  "Bạn là trợ lý ảo của cổng thông tin nội bộ phamphugia. Trả lời ngắn gọn, lịch sự bằng tiếng Việt. " +
  "Nếu câu hỏi không liên quan cổng hoặc bạn không chắc, hãy nói rõ và gợi ý liên hệ bộ phận phù hợp.";

const MAX_MESSAGES = 24;
const MAX_CONTENT_LEN = 8000;

/** Bỏ tin assistant đầu tiên (lời chào UI) để prior bắt đầu bằng user — Gemini cần xen kẽ từ user. */
function trimLeadingAssistantMessages(prior) {
  let i = 0;
  while (i < prior.length && prior[i].role === "assistant") i += 1;
  return prior.slice(i);
}

function validateAlternatingHistory(prior) {
  for (let j = 0; j < prior.length; j += 1) {
    const expected = j % 2 === 0 ? "user" : "assistant";
    if (prior[j].role !== expected) {
      throw new ApiError(
        400,
        "messages phải xen kẽ user và assistant, bắt đầu từ user",
      );
    }
  }
}

exports.chat = asyncHandler(async (req, res) => {
  const apiKey =
    typeof process.env.GEMINI_API_KEY === "string"
      ? process.env.GEMINI_API_KEY.trim()
      : "";
  if (!apiKey) {
    throw new ApiError(503, "Chatbot chưa được cấu hình");
  }

  const { messages: rawMessages } = req.body;
  if (!Array.isArray(rawMessages) || rawMessages.length === 0) {
    throw new ApiError(400, "messages phải là mảng không rỗng");
  }

  const trimmed = rawMessages.slice(-MAX_MESSAGES).map((m) => {
    if (!m || typeof m !== "object") {
      throw new ApiError(400, "Mỗi phần tử messages phải là object");
    }
    const role =
      m.role === "assistant" ? "assistant" : m.role === "user" ? "user" : null;
    if (!role) {
      throw new ApiError(400, "role chỉ được phép là user hoặc assistant");
    }
    const content = typeof m.content === "string" ? m.content.trim() : "";
    if (!content) {
      throw new ApiError(400, "content không được để trống");
    }
    if (content.length > MAX_CONTENT_LEN) {
      throw new ApiError(400, `content tối đa ${MAX_CONTENT_LEN} ký tự`);
    }
    return { role, content };
  });

  const last = trimmed[trimmed.length - 1];
  if (last.role !== "user") {
    throw new ApiError(400, "Tin nhắn cuối phải từ phía người dùng");
  }

  const prior = trimLeadingAssistantMessages(trimmed.slice(0, -1));
  validateAlternatingHistory(prior);

  const modelName = (process.env.GEMINI_MODEL || "gemini-2.0-flash").trim();
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: modelName,
    systemInstruction: SYSTEM_PROMPT,
  });

  const history = prior.map((m) => ({
    role: m.role === "user" ? "user" : "model",
    parts: [{ text: m.content }],
  }));

  const chatSession = model.startChat({ history });

  let result;
  try {
    result = await chatSession.sendMessage(last.content);
  } catch (err) {
    const msg =
      typeof err?.message === "string" && err.message.trim()
        ? err.message.trim()
        : "Lỗi khi gọi Gemini";
    throw new ApiError(502, msg);
  }

  let text;
  try {
    text = result.response.text();
  } catch {
    throw new ApiError(502, "Phản hồi AI bị chặn hoặc không hợp lệ");
  }

  if (!text || typeof text !== "string") {
    throw new ApiError(502, "Phản hồi AI không hợp lệ");
  }

  return successResponse(res, { message: text.trim() });
});
