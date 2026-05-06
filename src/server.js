const app = require('./app');
const { sequelize } = require('./models');

const PORT = process.env.PORT || 3001;

async function startServer() {
  try {
    await sequelize.authenticate();
    console.log('PostgreSQL connected successfully.');

    // Production: không alter cột tự động (nhanh, an toàn). Dev: sync + alter tiện chỉnh model.
    if (process.env.NODE_ENV === 'production') {
      await sequelize.sync();
    } else {
      await sequelize.sync({ alter: true });
    }
    console.log('Database synced.');

    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('Unable to start server:', error);
    process.exit(1);
  }
}

startServer();
