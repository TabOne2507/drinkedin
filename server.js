require('dotenv').config();
const express = require('express');
const path = require('path');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
const { helmetConfig, apiLimiter, antiReverseEngineering } = require('./src/middleware/security');
const { router: postsRouter, setSupabase } = require('./src/routes/posts');

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize Supabase
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);
setSupabase(supabase);

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
  ║   Database: Supabase                              ║
  ║                                                   ║
  ║   "Take that corporate energy to LinkedIn" 🚫     ║
  ║                                                   ║
  ╚═══════════════════════════════════════════════════╝
  `);
});

module.exports = app;
