const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const VisitorsLog = sequelize.define('VisitorsLog', {
    id: {
      type: DataTypes.BIGINT,
      primaryKey: true,
      autoIncrement: true,
    },
    ip_address: {
      type: DataTypes.STRING(45),
      allowNull: false,
    },
    user_agent: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    page_url: {
      type: DataTypes.STRING(500),
      allowNull: false,
    },
    visited_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  }, {
    tableName: 'visitors_log',
    timestamps: false,
    underscored: true,
    indexes: [
      { fields: ['visited_at'] },
      { fields: ['ip_address'] },
    ],
  });

  VisitorsLog.associate = (models) => {
    VisitorsLog.belongsTo(models.User, {
      foreignKey: 'user_id',
      as: 'user',
    });
  };

  return VisitorsLog;
};
