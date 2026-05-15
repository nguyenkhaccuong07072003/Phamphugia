const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { User } = require("../models");
const { getJwtConfig } = require("../config/jwt");
const asyncHandler = require("../utils/asyncHandler");
const ApiError = require("../utils/ApiError");
const { successResponse } = require("../utils/response");

// POST /api/auth/login
exports.login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const user = await User.scope("withPassword").findOne({ where: { email } });
  if (!user) {
    throw new ApiError(401, "Không tìm thấy tài khoản với email này.");
  }

  if (!user.is_active) {
    throw new ApiError(403, "Tài khoản đã bị vô hiệu hóa.");
  }

  const isMatch = await bcrypt.compare(password, user.password_hash);
  if (!isMatch) {
    throw new ApiError(401, "Mật khẩu không đúng.");
  }

  await user.update({ last_login_at: new Date() });

  const jwtConfig = getJwtConfig();
  const token = jwt.sign(
    { userId: user.id, role: user.role },
    jwtConfig.secret,
    { expiresIn: jwtConfig.expiresIn },
  );

  const refreshToken = jwt.sign(
    { userId: user.id },
    jwtConfig.refreshSecret,
    { expiresIn: jwtConfig.refreshExpiresIn },
  );

  return successResponse(
    res,
    {
      token,
      refreshToken,
      user: {
        id: user.id,
        employee_code: user.employee_code,
        full_name: user.full_name,
        email: user.email,
        role: user.role,
        position: user.position,
        avatar_url: user.avatar_url,
      },
    },
    "Đăng nhập thành công",
  );
});

// POST /api/auth/refresh
exports.refresh = asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) {
    throw new ApiError(400, "Thiếu refresh token.");
  }

  const jwtConfig = getJwtConfig();
  const decoded = jwt.verify(refreshToken, jwtConfig.refreshSecret);
  const user = await User.findByPk(decoded.userId);

  if (!user || !user.is_active) {
    throw new ApiError(
      401,
      "Refresh token không hợp lệ hoặc tài khoản không còn hoạt động.",
    );
  }

  const token = jwt.sign(
    { userId: user.id, role: user.role },
    jwtConfig.secret,
    { expiresIn: jwtConfig.expiresIn },
  );

  return successResponse(res, { token }, "Đã làm mới phiên đăng nhập");
});

// GET /api/auth/me
exports.getMe = asyncHandler(async (req, res) => {
  const user = await User.findByPk(req.user.id, {
    include: [{ association: "department", attributes: ["id", "name"] }],
  });

  return successResponse(res, user);
});

// PUT /api/auth/change-password
exports.changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  const user = await User.scope("withPassword").findByPk(req.user.id);
  const isMatch = await bcrypt.compare(currentPassword, user.password_hash);

  if (!isMatch) {
    throw new ApiError(400, "Mật khẩu hiện tại không đúng.");
  }

  const salt = await bcrypt.genSalt(10);
  user.password_hash = await bcrypt.hash(newPassword, salt);
  await user.save();

  return successResponse(res, null, "Đổi mật khẩu thành công");
});
