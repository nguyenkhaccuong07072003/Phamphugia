const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const User = sequelize.define('User', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    employee_code: {
      type: DataTypes.STRING(20),
      allowNull: false,
      unique: true,
    },
    full_name: {
      type: DataTypes.STRING(150),
      allowNull: false,
    },
    email: {
      type: DataTypes.STRING(150),
      allowNull: false,
      unique: true,
    },
    password_hash: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    department_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    position: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    avatar_url: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },
    role: {
      type: DataTypes.ENUM('admin', 'editor', 'viewer'),
      allowNull: false,
      defaultValue: 'viewer',
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    last_login_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  }, {
    tableName: 'users',
    timestamps: true,
    underscored: true,
    defaultScope: {
      attributes: { exclude: ['password_hash'] },
    },
    scopes: {
      withPassword: {
        attributes: {},
      },
    },
  });

  User.associate = (models) => {
    User.belongsTo(models.Department, {
      foreignKey: 'department_id',
      as: 'department',
    });
    User.hasMany(models.NewsArticle, {
      foreignKey: 'author_id',
      as: 'articles',
    });
    User.hasMany(models.File, {
      foreignKey: 'uploaded_by',
      as: 'uploadedFiles',
    });
  };

  return User;
};
