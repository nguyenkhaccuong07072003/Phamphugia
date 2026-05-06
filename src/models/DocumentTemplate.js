const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  const DocumentTemplate = sequelize.define(
    "DocumentTemplate",
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      name: {
        type: DataTypes.STRING(300),
        allowNull: false,
      },
      slug: {
        type: DataTypes.STRING(300),
        allowNull: false,
        unique: true,
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      template_type: {
        type: DataTypes.ENUM("docx", "xlsx"),
        allowNull: false,
      },
      template_file_url: {
        type: DataTypes.STRING(500),
        allowNull: false,
      },
      questions: {
        type: DataTypes.JSONB,
        allowNull: false,
        defaultValue: [],
      },
      blanks: {
        type: DataTypes.JSONB,
        allowNull: true,
        defaultValue: null,
      },
      category: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },
      icon: {
        type: DataTypes.STRING(50),
        allowNull: true,
        defaultValue: "description",
      },
      sort_order: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      is_active: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      department_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      company_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      created_by: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
    },
    {
      tableName: "document_templates",
      timestamps: true,
      underscored: true,
      indexes: [
        { fields: ["is_active", "sort_order"] },
        { fields: ["category", "is_active"] },
        { fields: ["department_id", "is_active"] },
        { fields: ["company_id", "is_active"] },
        { fields: ["department_id", "company_id", "is_active"] },
      ],
    },
  );

  DocumentTemplate.associate = (models) => {
    DocumentTemplate.belongsTo(models.User, {
      foreignKey: "created_by",
      as: "creator",
    });
    DocumentTemplate.belongsTo(models.Department, {
      foreignKey: "department_id",
      as: "department",
    });
    DocumentTemplate.belongsTo(models.Company, {
      foreignKey: "company_id",
      as: "company",
    });
    DocumentTemplate.hasMany(models.DocumentSubmission, {
      foreignKey: "template_id",
      as: "submissions",
    });
  };

  return DocumentTemplate;
};
