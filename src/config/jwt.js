const ApiError = require("../utils/ApiError");

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new ApiError(500, `${name} is not configured`);
  }
  return value;
}

function getJwtConfig() {
  return {
    secret: requireEnv("JWT_SECRET"),
    refreshSecret: requireEnv("JWT_REFRESH_SECRET"),
    expiresIn: process.env.JWT_EXPIRES_IN || "24h",
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || "7d",
  };
}

module.exports = { getJwtConfig };
