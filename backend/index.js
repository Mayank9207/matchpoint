// index.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const connectdb = require('./config/db');

const app = express();

/**
 * ====== Server settings ======
 */
// If behind a proxy (Render, Heroku, Cloudflare), enable this so secure cookies work
app.set('trust proxy', 1);

/**
 * ====== Defensive CORS logic ======
 *
 * - Allows explicit origins listed in allowedOrigins
 * - Allows any vercel.preview origin (hostname endsWith '.vercel.app')
 * - Allows non-browser requests (no Origin) like curl / server-to-server
 * - Logs origin checks so you can debug quickly in Render logs
 */
const allowedOrigins = [
  'https://matchpoint-kappa.vercel.app',
  'http://localhost:5173',
  // Add any additional explicit origins you want to allow
];

function isVercelPreviewOrigin(origin) {
  if (typeof origin !== 'string') return false;
  try {
    const hostname = new URL(origin).hostname; // parse safely
    return hostname.endsWith('.vercel.app');
  } catch (err) {
    // fallback: string-based check
    return origin.endsWith('.vercel.app');
  }
}

const corsOptions = {
  origin: (origin, callback) => {
    // Allow server-to-server or non-browser requests (no Origin header)
    if (!origin) {
      console.log('[CORS] No origin (server-to-server or curl) — allowing request');
      return callback(null, true);
    }

    if (typeof origin !== 'string') {
      console.warn('[CORS] invalid origin type:', typeof origin);
      return callback(new Error('Invalid origin'), false);
    }

    const allowed = allowedOrigins.includes(origin) || isVercelPreviewOrigin(origin);
    console.log(`[CORS] origin="${origin}" allowed=${allowed}`);
    if (allowed) return callback(null, true);
    return callback(new Error(`CORS blocked: ${origin}`), false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'X-Requested-With'],
  optionsSuccessStatus: 200
};

/**
 * ====== Apply CORS and basic logging early ======
 * CORS must run before routes so preflight and headers are attached.
 */
app.use((req, res, next) => {
  console.log(`[INCOMING] ${new Date().toISOString()} ${req.method} ${req.url} Origin=${req.headers.origin || 'none'}`);
  next();
});

app.use(cors(corsOptions));

// IMPORTANT: use a named wildcard here to avoid path-to-regexp errors.
// Using a bare '*' can throw "Missing parameter name at index 1: *" in some environments.
app.options('/*path', cors(corsOptions)); // handle preflight for any path

/**
 * ====== Middlewares ======
 */
app.use(express.json());
app.use(cookieParser());

/**
 * ====== Routes ======
 * Keep these after CORS and parsing middlewares
 */
app.use('/api/auth', require('./routes/auth'));
app.use('/api/matches', require('./routes/match'));

// Health check
app.get('/api/health', (req, res) => res.json({ ok: true }));

// Root
app.get('/', (req, res) => res.json({ ok: true, message: 'MatchPoint backend running 🚀' }));

/**
 * ====== 404 handler ======
 * Use a named wildcard so it doesn't accidentally become an error-handling middleware
 */
app.use('/*path', (req, res) => {
  res.status(404).json({ success: false, error: 'Not Found' });
});

/**
 * ====== Global error handler ======
 * Always return JSON and log the full error for debugging
 */
app.use((err, req, res, next) => {
  console.error('[ERROR HANDLER]', err && (err.stack || err));
  // If CORS blocked error happened, give a 403 to be explicit (optional)
  if (err && typeof err.message === 'string' && err.message.startsWith('CORS blocked')) {
    return res.status(403).json({ success: false, error: err.message });
  }
  res.status(err && err.status ? err.status : 500).json({ success: false, error: err && err.message ? err.message : 'Server error' });
});

/**
 * ====== Start / Connect DB ======
 */
const PORT = process.env.PORT || 5000;

connectdb()
  .then(() => {
    console.log('Connected to DB ✅');
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Database connection failed:', err && (err.message || err));
    // If DB fails to connect, still start the server? Usually better to exit.
    process.exit(1);
  });

/**
 * ====== Graceful shutdown handlers (optional but useful) ======
 */
process.on('SIGINT', () => {
  console.log('SIGINT received — shutting down gracefully');
  process.exit(0);
});
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Rejection at:', reason);
});
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  process.exit(1);
});
