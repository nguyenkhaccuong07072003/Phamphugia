const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const SocialLink = sequelize.define('SocialLink', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    platform: {
      type: DataTypes.ENUM('website', 'facebook', 'zalo'),
      allowNull: false,
    },
    name: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    url: {
      type: DataTypes.STRING(500),
      allowNull: false,
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
  }, {
    tableName: 'social_links',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false,
    underscored: true,
  });

  return SocialLink;
};
