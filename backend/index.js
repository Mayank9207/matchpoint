require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const cookieParser = require('cookie-parser');
const connectdb=require('./config/db');
// Create Express app
const app = express();

/*
“Why call connectdb() before app.listen()?”
Because you want to make sure the app only
 starts listening after the database connection is successful —
 otherwise, you could accept requests that depend on DB access before it’s ready.
*/
// Middleware setup
// Replace your current app.use(cors()) with this:
// matchpoint/backend/index.js

const allowedOrigins = [
  'https://matchpoint-ch14mpj72-mayanks-projects-32f0b049.vercel.app', // Your NEW link
  'http://localhost:5173'
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('CORS blocked: Origin not allowed'));
    }
  },
  credentials: true
}));

app.use(express.json());
app.use(cookieParser());

// Optional logging middleware (handy for debugging)
app.use((req, res, next) => {
  console.log(`[${req.method}] ${req.url}`);
  next();
});

// Routes (you’ll create these soon)
app.use('/api/auth', require('./routes/auth'));
app.use('/api/matches', require('./routes/match'));

// Simple API health check for frontend handshake verification
app.get('/api/health', (req, res) => {
  res.json({ ok: true });
});

// Health check route
app.get('/', (req, res) => {
  res.json({ ok: true, message: 'MatchPoint backend running 🚀' });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ success: false, error: 'Not Found' });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ success: false, error: err.message || 'Server error' });
});

// Database + Server start
const PORT = process.env.PORT || 5000;

// Attempt DB connection but don't crash the process if it fails.
// This makes the backend resilient during local development or if the DB is temporarily unreachable.
connectdb()
  .then(() => {
    console.log('Connected to DB ✅');
  })
  .catch((err) => {
    console.error('Database connection failed (continuing without DB):', err.message || err);
  })
  .finally(() => {
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  });
