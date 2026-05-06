const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const File = sequelize.define('File', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    original_name: {
      type: DataTypes.STRING(300),
      allowNull: false,
    },
    stored_name: {
      type: DataTypes.STRING(300),
      allowNull: false,
      unique: true,
    },
    file_path: {
      type: DataTypes.STRING(500),
      allowNull: false,
    },
    mime_type: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    file_size: {
      type: DataTypes.BIGINT,
      allowNull: false,
    },
    file_hash: {
      type: DataTypes.STRING(64),
      allowNull: true,
    },
    uploaded_by: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
  }, {
    tableName: 'files',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false,
    underscored: true,
  });

  File.associate = (models) => {
    File.belongsTo(models.User, {
      foreignKey: 'uploaded_by',
      as: 'uploader',
    });
  };

  return File;
};
