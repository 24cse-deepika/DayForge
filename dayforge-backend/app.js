const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const pool = require('./db/pool');

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());

// Import routes
const authRoutes = require('./routes/auth');
const taskRoutes = require('./routes/tasks');
const blockedIntervalRoutes = require('./routes/blockedIntervals');

// Use routes
app.use('/api/auth', authRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/blocked-intervals', blockedIntervalRoutes);

// Quick way to confirm the running server can actually reach Postgres,
// separate from db/testConnection.js (which checks before the server starts).
app.get('/api/health/db', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ db: 'connected' });
  } catch (err) {
    res.status(500).json({ db: 'unreachable', error: err.message });
  }
});

// 404 handler
app.use((req, res, next) => {
  res.status(404).json({ error: 'Not Found' });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

module.exports = app;