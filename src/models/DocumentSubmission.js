const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const DocumentSubmission = sequelize.define('DocumentSubmission', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    template_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    submitted_by: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    answers: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: {},
    },
    generated_file_url: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM('draft', 'completed'),
      allowNull: false,
      defaultValue: 'completed',
    },
  }, {
    tableName: 'document_submissions',
    timestamps: true,
    underscored: true,
    indexes: [
      { fields: ['template_id'] },
      { fields: ['submitted_by'] },
      { fields: ['status'] },
    ],
  });

  DocumentSubmission.associate = (models) => {
    DocumentSubmission.belongsTo(models.DocumentTemplate, {
      foreignKey: 'template_id',
      as: 'template',
    });
    DocumentSubmission.belongsTo(models.User, {
      foreignKey: 'submitted_by',
      as: 'submitter',
    });
  };

  return DocumentSubmission;
};
