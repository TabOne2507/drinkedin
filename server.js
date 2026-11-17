require('dotenv').config();
const express = require('express');
const path = require('path');
const cors = require('cors');
const admin = require('firebase-admin');
const { helmetConfig, apiLimiter, antiReverseEngineering } = require('./src/middleware/security');
const { router: postsRouter, setDb } = require('./src/routes/posts');
const { router: activityRouter } = require('./src/routes/activity');
const { router: statsRouter, setDb: setStatsDb } = require('./src/routes/stats');
const { router: adminRouter, setDb: setAdminDb } = require('./src/routes/admin');
const tracking = require('./src/services/tracking');

const app = express();
const PORT = process.env.PORT || 3000;

// Render sits behind a proxy; trust the first hop for real client IPs.
app.set('trust proxy', 1);

// Initialize Firebase Admin
let serviceAccount;
if (process.env.NODE_ENV === 'production') {
  serviceAccount = require('/etc/secrets/serviceAccountKey.json');
} else if (process.env.FIREBASE_SERVICE_ACCOUNT) {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT.trim();
  const json = raw.startsWith('{') ? raw : Buffer.from(raw, 'base64').toString('utf8');
  serviceAccount = JSON.parse(json);
  if (serviceAccount.private_key) {
    serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
  }
} else {
  serviceAccount = require('./serviceAccountKey.json');
}

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();
setDb(db);
setStatsDb(db);
setAdminDb(db);
tracking.setDb(db);
tracking.initialize();

// ============================================================
// Security Middleware
// ============================================================
app.use(helmetConfig);
app.use(antiReverseEngineering);

// CORS configuration
app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? [process.env.RENDER_EXTERNAL_URL || 'https://drinkedin.onrender.com']
    : ['http://localhost:3000', 'http://127.0.0.1:3000'],
  methods: ['GET', 'POST', 'DELETE'],
  allowedHeaders: ['Content-Type'],
}));

// Body parsing
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: false, limit: '10kb' }));

// ============================================================
// Static Files
// ============================================================
app.use(express.static(path.join(__dirname, 'public'), {
  etag: false,
  lastModified: false,
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    } else if (filePath.match(/\.(css|js)$/)) {
      res.setHeader('Cache-Control', 'public, max-age=86400');
    } else if (filePath.match(/\.(jpg|jpeg|png|gif|svg|ico|webp)$/)) {
      res.setHeader('Cache-Control', 'public, max-age=604800');
    }
  },
}));

// ============================================================
// API Routes
// ============================================================
app.use('/api/posts', apiLimiter, postsRouter);
app.use('/api/activity', apiLimiter, activityRouter);
app.use('/api/stats', apiLimiter, statsRouter);
app.use('/api/admin', adminRouter);

// Health check endpoint (for Render.com)
app.get('/api/health', (req, res) => {
  res.json({
    status: 'hungover but alive 🍺',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// ============================================================
// Admin Dashboard
// ============================================================
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// ============================================================
// SPA Fallback - serve index.html for all non-API routes
// ============================================================
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api/')) {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  }
});

// ============================================================
// Error Handling
// ============================================================
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    error: 'Something broke. Probably the server\'s spirit. 💀',
  });
});

// ============================================================
// Start Server
// ============================================================
app.listen(PORT, () => {
  console.log(`
  ╔═══════════════════════════════════════════════════╗
  ║                                                   ║
  ║   🍺 DrinkedIn Server Running                    ║
  ║   The Unprofessional Network                      ║
  ║                                                   ║
  ║   Port: ${PORT}                                      ║
  ║   Mode: ${process.env.NODE_ENV || 'development'}                            ║
  ║   Database: Firestore                              ║
  ║                                                   ║
  ║   "Take that corporate energy elsewhere" 🚫    ║
  ║                                                   ║
  ╚═══════════════════════════════════════════════════╝
  `);
});

module.exports = app;
