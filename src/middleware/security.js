const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

/**
 * Security middleware configuration for DrinkedIn
 * Implements Helmet.js, rate limiting, and anti-reverse-engineering headers
 */

// Helmet configuration with strict CSP
const helmetConfig = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "blob:"],
      connectSrc: ["'self'"],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      frameAncestors: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: 'same-origin' },
  crossOriginOpenerPolicy: { policy: 'same-origin' },
  referrerPolicy: { policy: 'no-referrer' },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },
  noSniff: true,
  xssFilter: true,
  hidePoweredBy: true,
});

// Rate limiter - 100 requests per 15 minutes per IP
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many requests from this IP. Maybe go touch grass? 🌿',
    retryAfter: '15 minutes',
  },
  keyGenerator: (req) => {
    return req.headers['x-forwarded-for'] || req.ip;
  },
});

// Stricter rate limit for post creation
const postLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "Whoa there, slow down! Even rage has limits. Try again in a few minutes. 🍺",
  },
});

// Anti-reverse-engineering headers
const antiReverseEngineering = (req, res, next) => {
  // Remove server identification
  res.removeHeader('X-Powered-By');
  res.removeHeader('Server');

  // Prevent caching of API responses
  if (req.path.startsWith('/api/')) {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
  }

  // Prevent embedding in iframes
  res.set('X-Frame-Options', 'DENY');

  // Prevent MIME type sniffing
  res.set('X-Content-Type-Options', 'nosniff');

  // Disable client-side caching for HTML
  if (req.path === '/' || req.path.endsWith('.html')) {
    res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
  }

  next();
};

module.exports = {
  helmetConfig,
  apiLimiter,
  postLimiter,
  antiReverseEngineering,
};
