const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const SiteSetting = sequelize.define('SiteSetting', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    key: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: true,
    },
    value: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    description: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
  }, {
    tableName: 'site_settings',
    timestamps: true,
    createdAt: false,
    updatedAt: 'updated_at',
    underscored: true,
  });

  return SiteSetting;
};
