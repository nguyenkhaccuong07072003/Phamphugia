/**
 * Tạo / khôi phục tài khoản admin tạm (sau khi xóa nhầm user trong DB).
 *
 * Chạy từ thư mục phamphugia-be:
 *   node scripts/add-temp-admin.js
 *
 * Hoặc chỉ định biến môi trường (không commit mật khẩu):
 *   set TEMP_ADMIN_EMAIL=you@company.com
 *   set TEMP_ADMIN_PASSWORD=YourStrongPass
 *   set TEMP_ADMIN_CODE=NV001
 *   node scripts/add-temp-admin.js
 *
 * PowerShell:
 *   $env:TEMP_ADMIN_EMAIL="admin@local.test"; $env:TEMP_ADMIN_PASSWORD="..."; node scripts/add-temp-admin.js
 */

require("../src/loadEnv");

const bcrypt = require("bcryptjs");
const { User, sequelize } = require("../src/models");

const SALT_ROUNDS = 10;

async function main() {
  // Trùng với dòng demo trên AdminLogin.vue (admin@phamphugia.vn / admin)
  const email = (process.env.TEMP_ADMIN_EMAIL || "admin@phamphugia.vn")
    .trim()
    .toLowerCase();
  const password = process.env.TEMP_ADMIN_PASSWORD || "admin";
  const fullName = process.env.TEMP_ADMIN_NAME || "Quản trị (tạm)";
  const role = (process.env.TEMP_ADMIN_ROLE || "admin").toLowerCase();
  const codeFromEnv = process.env.TEMP_ADMIN_CODE
    ? String(process.env.TEMP_ADMIN_CODE).trim()
    : null;

  if (!["admin", "editor", "viewer"].includes(role)) {
    console.error("TEMP_ADMIN_ROLE phải là admin | editor | viewer");
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

  const existing = await User.unscoped().findOne({ where: { email } });

  if (existing) {
    await existing.update({
      password_hash: passwordHash,
      is_active: true,
      role,
      full_name: fullName,
    });
    console.log(`Đã cập nhật mật khẩu + kích hoạt user có email: ${email}`);
    console.log(`  role: ${role}`);
  } else {
    const employeeCode =
      codeFromEnv || `TEMP-${Date.now().toString(36).toUpperCase()}`;

    const dupCode = await User.findOne({
      where: { employee_code: employeeCode },
    });
    if (dupCode) {
      console.error(
        `Mã nhân viên "${employeeCode}" đã tồn tại. Đặt TEMP_ADMIN_CODE khác (vd. NV999).`,
      );
      process.exit(1);
    }

    await User.create({
      employee_code: employeeCode,
      full_name: fullName,
      email,
      password_hash: passwordHash,
      role,
      is_active: true,
      department_id: null,
      position: null,
    });
    console.log(`Đã tạo user mới: ${email}`);
    console.log(`  employee_code: ${employeeCode}`);
    console.log(`  role: ${role}`);
  }

  console.log("");
  console.log("Đăng nhập /admin/login bằng email + mật khẩu trên.");
  console.log("Xóa script hoặc đổi mật khẩu sau khi ổn định tài khoản thật.");
  await sequelize.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
