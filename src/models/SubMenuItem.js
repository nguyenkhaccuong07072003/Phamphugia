const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const SubMenuItem = sequelize.define('SubMenuItem', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    department_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    label: {
      type: DataTypes.STRING(150),
      allowNull: false,
    },
    slug: {
      type: DataTypes.STRING(200),
      allowNull: true,
    },
    href: {
      type: DataTypes.STRING(255),
      allowNull: false,
      defaultValue: '#',
    },
    content: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    sort_order: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    parent_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: null,
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
  }, {
    tableName: 'sub_menu_items',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false,
    underscored: true,
  });

  SubMenuItem.associate = (models) => {
    SubMenuItem.belongsTo(models.Department, {
      foreignKey: 'department_id',
      as: 'department',
    });
    SubMenuItem.hasMany(models.SubMenuItem, {
      foreignKey: 'parent_id',
      as: 'children',
      constraints: false,
    });
    SubMenuItem.belongsTo(models.SubMenuItem, {
      foreignKey: 'parent_id',
      as: 'parent',
      constraints: false,
    });
  };

  return SubMenuItem;
};
