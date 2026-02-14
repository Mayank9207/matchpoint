require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const cookieParser = require('cookie-parser');
const connectdb = require('./config/db');

const app = express();

// 1. DYNAMIC CORS SETUP
const allowedOrigins = [
  'https://matchpoint-dg981sm82-mayanks-projects-32f0b049.vercel.app',
  'https://matchpoint-ch14mpj72-mayanks-projects-32f0b049.vercel.app',
  'http://localhost:5173'
];

const corsOptions = {
  origin: (origin, callback) => {
    // Allows if in list OR any Vercel preview link (ends with .vercel.app)
    if (!origin || allowedOrigins.includes(origin) || origin.endsWith('.vercel.app')) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200 
};

// 2. APPLY CORS MIDDLEWARE
app.use(cors(corsOptions));

// 3. FIX FOR EXPRESS v5 PathError (Named wildcard fixed from '*' to '/*path')
app.options('/*path', cors(corsOptions)); 

app.use(express.json());
app.use(cookieParser());

app.use((req, res, next) => {
  console.log(`[${req.method}] ${req.url}`);
  next();
});

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/matches', require('./routes/match'));

// Health checks
app.get('/api/health', (req, res) => res.json({ ok: true }));
app.get('/', (req, res) => res.json({ ok: true, message: 'MatchPoint backend running 🚀' }));

// 4. FIX 404 HANDLER (Named wildcard for Express compatibility)
app.use('/*path', (req, res) => {
  res.status(404).json({ success: false, error: 'Not Found' });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ success: false, error: err.message || 'Server error' });
});

const PORT = process.env.PORT || 5000;

connectdb()
  .then(() => {
    console.log('Connected to DB ✅');
  })
  .catch((err) => {
    console.error('Database connection failed:', err.message || err);
  })
  .finally(() => {
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  });
