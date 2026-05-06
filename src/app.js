const express = require('express');
const cors = require('cors');
const path = require('path');
const corsConfig = require('./config/cors');
const routes = require('./routes');
const errorHandler = require('./middleware/errorHandler');

const app = express();

// Global middleware
app.use(cors(corsConfig));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Serve uploaded files as static
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

// Routes
app.use('/api', routes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Route not found' });
});

// Global error handler
app.use(errorHandler);

module.exports = app;
