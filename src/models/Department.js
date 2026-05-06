const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Department = sequelize.define('Department', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    name: {
      type: DataTypes.STRING(200),
      allowNull: false,
    },
    slug: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: true,
    },
    phone: {
      type: DataTypes.STRING(20),
      allowNull: true,
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
    tableName: 'departments',
    timestamps: true,
    underscored: true,
  });

  Department.associate = (models) => {
    Department.hasMany(models.SubMenuItem, {
      foreignKey: 'department_id',
      as: 'subMenuItems',
    });
    Department.hasMany(models.User, {
      foreignKey: 'department_id',
      as: 'users',
    });
    Department.hasMany(models.NewsArticle, {
      foreignKey: 'department_id',
      as: 'newsArticles',
    });
  };

  return Department;
};
