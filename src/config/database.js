require("../loadEnv");

module.exports = {
  host: process.env.DB_HOST || "localhost",
  port: parseInt(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME || "phamphugia_intranet",
  username: process.env.DB_USER || "postgres",
  password: process.env.DB_PASSWORD || "",
  dialect: "postgres",
  logging: false,
  define: {
    charset: "utf8",
    collate: "utf8_general_ci",
  },
  pool: {
    max: 10,
    min: 0,
    acquire: 30000,
    idle: 10000,
  },
};
