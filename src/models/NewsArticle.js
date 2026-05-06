const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const NewsArticle = sequelize.define('NewsArticle', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    title: {
      type: DataTypes.STRING(300),
      allowNull: false,
    },
    slug: {
      type: DataTypes.STRING(300),
      allowNull: false,
      unique: true,
    },
    content: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    specifications: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    catalogue_blocks: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: [],
    },
    thumbnail_url: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },
    image_urls: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: [],
    },
    category_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    department_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    author_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    is_normal: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    is_highlight: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    is_slider: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    slider_sort_order: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    view_count: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    is_published: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    is_pinned: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    published_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  }, {
    tableName: 'news_articles',
    timestamps: true,
    underscored: true,
    indexes: [
      { fields: ['is_published', 'published_at'] },
      { fields: ['category_id', 'is_published'] },
      { fields: ['department_id', 'is_published'] },
      { fields: ['is_normal', 'is_published', 'published_at'] },
      { fields: ['is_highlight', 'is_published', 'published_at'] },
      { fields: ['is_slider', 'is_published', 'slider_sort_order'] },
      { fields: ['is_pinned', 'published_at'] },
    ],
  });

  NewsArticle.associate = (models) => {
    NewsArticle.belongsTo(models.NewsCategory, {
      foreignKey: 'category_id',
      as: 'category',
    });
    NewsArticle.belongsTo(models.Department, {
      foreignKey: 'department_id',
      as: 'department',
    });
    NewsArticle.belongsTo(models.User, {
      foreignKey: 'author_id',
      as: 'author',
    });
  };

  return NewsArticle;
};
