/**
 * Nạp .env một lần cho toàn bộ process (server + config/database).
 * override: true — ghi đè biến môi trường trống từ hệ thống nếu có.
 */
const path = require('path');
const envPath = path.join(__dirname, '..', '.env');

require('dotenv').config({ path: envPath, override: true });

module.exports = { envPath };
