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
app.use(cors());
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

connectdb().then(() => {
  // Only start the server if the DB connection is successful
  console.log('Connected to DB ✅');
  app.listen(PORT, () => {
    console.log(`Server running successfully on port ${PORT}`);
  });

}).catch(err => {
    // If connection fails, log the error and exit
    console.error("Database connection failed, server did not start.", err);
    process.exit(1);
});
