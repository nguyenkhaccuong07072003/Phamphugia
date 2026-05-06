const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Position = sequelize.define('Position', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    name: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    code: {
      type: DataTypes.STRING(20),
      allowNull: false,
      unique: true,
    },
    level: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
      comment: 'Cấp bậc: 1-Nhân viên, 2-Phó phòng, 3-Trưởng phòng, 4-Phó GĐ, 5-Giám đốc',
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
  }, {
    tableName: 'positions',
    timestamps: true,
    underscored: true,
  });

  Position.associate = (models) => {
    Position.hasMany(models.Employee, {
      foreignKey: 'position_id',
      as: 'employees',
    });
  };

  return Position;
};
