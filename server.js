require('dotenv').config();
const express = require('express');
const path = require('path');
const cors = require('cors');
const admin = require('firebase-admin');
const { helmetConfig, apiLimiter, antiReverseEngineering } = require('./src/middleware/security');
const { router: postsRouter, setDb } = require('./src/routes/posts');

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize Firebase Admin
// Local dev: reads from serviceAccountKey.json in project root
// Production (Render.com): reads from FIREBASE_SERVICE_ACCOUNT env var
let serviceAccount;
if (process.env.FIREBASE_SERVICE_ACCOUNT) {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT.trim();
  const json = raw.startsWith('{') ? raw : Buffer.from(raw, 'base64').toString('utf8');
  serviceAccount = JSON.parse(json);
  // Ensure private key has proper newlines
  if (serviceAccount.private_key) {
    serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
  }
  console.log('Firebase project:', serviceAccount.project_id);
  console.log('Firebase email:', serviceAccount.client_email);
  console.log('Private key starts with:', serviceAccount.private_key.substring(0, 30));
} else {
  serviceAccount = require('./serviceAccountKey.json');
}

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();
setDb(db);

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
    // Cache assets aggressively, HTML never
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

// Health check endpoint (for Render.com)
app.get('/api/health', (req, res) => {
  res.json({
    status: 'hungover but alive 🍺',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
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
  ║   "Take that corporate energy to LinkedIn" 🚫     ║
  ║                                                   ║
  ╚═══════════════════════════════════════════════════╝
  `);
});

module.exports = app;
