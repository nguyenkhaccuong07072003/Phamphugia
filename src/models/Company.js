const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  const Company = sequelize.define(
    "Company",
    {
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
        type: DataTypes.STRING(255),
        allowNull: true,
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
    },
    {
      tableName: "companies",
      timestamps: true,
      underscored: true,
    },
  );

  Company.associate = (models) => {
    // Company.hasMany(models.User, {
    //   foreignKey: 'company_id',
    //   as: 'users',
    // });
  };

  return Company;
};
