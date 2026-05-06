const { Sequelize } = require("sequelize");
const dbConfig = require("../config/database");

const sequelize = new Sequelize(
  dbConfig.database,
  dbConfig.username,
  dbConfig.password,
  {
    host: dbConfig.host,
    port: dbConfig.port,
    dialect: dbConfig.dialect,
    logging: dbConfig.logging,
    pool: dbConfig.pool,
  },
);

const models = {};

// Import each model
const modelDefiners = [
  require("./Department"),
  require("./Company"),
  require("./SubMenuItem"),
  require("./User"),
  require("./NewsCategory"),
  require("./NewsArticle"),
  require("./Slide"),
  require("./Office"),
  require("./SocialLink"),
  require("./SiteSetting"),
  require("./VisitorsLog"),
  require("./File"),
  // Digitization Module
  require("./DocumentTemplate"),
  require("./DocumentSubmission"),
];

modelDefiners.forEach((definer) => {
  const model = definer(sequelize);
  models[model.name] = model;
});

// Run associations
Object.values(models).forEach((model) => {
  if (model.associate) {
    model.associate(models);
  }
});

models.sequelize = sequelize;
models.Sequelize = Sequelize;

module.exports = models;
