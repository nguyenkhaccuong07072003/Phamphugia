const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const NewsCategory = sequelize.define('NewsCategory', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    name: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    slug: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: true,
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
    tableName: 'news_categories',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false,
    underscored: true,
  });

  NewsCategory.associate = (models) => {
    NewsCategory.hasMany(models.NewsArticle, {
      foreignKey: 'category_id',
      as: 'articles',
    });
  };

  return NewsCategory;
};
