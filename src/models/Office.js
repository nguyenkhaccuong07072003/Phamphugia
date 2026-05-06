const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Office = sequelize.define('Office', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    name: {
      type: DataTypes.STRING(150),
      allowNull: false,
    },
    address: {
      type: DataTypes.STRING(300),
      allowNull: false,
    },
    map_embed_url: {
      type: DataTypes.STRING(1000),
      allowNull: true,
    },
    phone: {
      type: DataTypes.STRING(20),
      allowNull: true,
    },
    is_headquarters: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
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
    tableName: 'offices',
    timestamps: true,
    underscored: true,
  });

  return Office;
};
