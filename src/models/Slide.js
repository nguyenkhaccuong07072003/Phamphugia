const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Slide = sequelize.define('Slide', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    title: {
      type: DataTypes.STRING(200),
      allowNull: false,
    },
    image_url: {
      type: DataTypes.STRING(500),
      allowNull: false,
    },
    link_url: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },
    color: {
      type: DataTypes.STRING(7),
      allowNull: false,
      defaultValue: '#1a3a5c',
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
    start_date: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },
    end_date: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },
  }, {
    tableName: 'slides',
    timestamps: true,
    underscored: true,
  });

  return Slide;
};
