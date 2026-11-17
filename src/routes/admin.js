/**
 * DrinkedIn - Admin dashboard API
 *
 * Credentials come exclusively from environment variables:
 *   ADMIN_USERNAME, ADMIN_PASSWORD
 *
 * Sessions are held in memory and delivered as an HttpOnly, SameSite=Strict
 * cookie. A server restart simply signs the admin out.
 */

const express = require('express');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const tracking = require('../services/tracking');

const router = express.Router();

const COOKIE_NAME = 'drinkedin_admin';
const SESSION_TTL_MS = 8 * 60 * 60 * 1000;
const SESSION_MAX = 5;

let db = null;
const sessions = new Map();
let statsCache = { data: null, expiresAt: 0 };
const STATS_CACHE_MS = 30 * 1000;

function setDb(firestoreInstance) {
  db = firestoreInstance;
}

function getCredentials() {
  const username = process.env.ADMIN_USERNAME;
  const password = process.env.ADMIN_PASSWORD;
  if (!username || !password) return null;
  return { username, password };
}

function safeEqual(a, b) {
  const hashA = crypto.createHash('sha256').update(String(a)).digest();
  const hashB = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(hashA, hashB);
}

function parseCookies(req) {
  return String(req.headers.cookie || '').split(';').reduce((cookies, part) => {
    const index = part.indexOf('=');
    if (index > 0) {
      const key = part.slice(0, index).trim();
      const value = part.slice(index + 1).trim();
      if (key) {
        try {
          cookies[key] = decodeURIComponent(value);
        } catch {
          cookies[key] = value;
        }
      }
    }
    return cookies;
  }, {});
}

function cookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
  };
}

function cleanupSessions() {
  const now = Date.now();
  for (const [token, session] of sessions) {
    if (session.expiresAt <= now) sessions.delete(token);
  }
}

function requireAdmin(req, res, next) {
  cleanupSessions();
  const token = parseCookies(req)[COOKIE_NAME];
  const session = token ? sessions.get(token) : null;

  if (!session || session.expiresAt <= Date.now()) {
    if (token) sessions.delete(token);
    return res.status(401).json({ error: 'Admin authentication required.' });
  }

  req.admin = session;
  res.set('Cache-Control', 'no-store');
  next();
}

function toDate(value) {
  if (!value) return null;
  if (typeof value.toDate === 'function') return value.toDate();
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function serializeValue(value) {
  if (value === null || value === undefined) return value;
  if (typeof value.toDate === 'function') return value.toDate().toISOString();
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'object' && typeof value._seconds === 'number') {
    return new Date(value._seconds * 1000).toISOString();
  }
  return value;
}

function serializeDoc(doc) {
  const data = doc.data() || {};
  const result = { id: doc.id };
  Object.keys(data).forEach((key) => {
    result[key] = serializeValue(data[key]);
  });
  return result;
}

function reactionTotal(reactions) {
  if (!reactions || typeof reactions !== 'object') return 0;
  return Object.values(reactions).reduce((sum, count) => sum + (Number(count) || 0), 0);
}

function startOfToday() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

function sortByCreatedDesc(a, b) {
  const aTime = new Date(a.created_at || a.created || 0).getTime();
  const bTime = new Date(b.created_at || b.created || 0).getTime();
  return bTime - aTime;
}

// Brute-force protection for the login form.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts. Try again in 15 minutes.' },
});

// Broad limiter for dashboard refreshes.
const adminLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 1200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many admin requests. Slow down.' },
});

router.use(adminLimiter);
router.use((req, res, next) => {
  res.set('Cache-Control', 'no-store');
  res.set('X-Robots-Tag', 'noindex, nofollow');
  next();
});

router.post('/login', loginLimiter, async (req, res) => {
  const credentials = getCredentials();

  if (!credentials) {
    return res.status(503).json({
      error: 'Admin credentials are not configured. Set ADMIN_USERNAME and ADMIN_PASSWORD environment variables.',
    });
  }

  const { username, password } = req.body || {};
  if (typeof username !== 'string' || typeof password !== 'string') {
    return res.status(400).json({ error: 'Username and password are required.' });
  }

  if (!safeEqual(username.trim().toLowerCase(), credentials.username.trim().toLowerCase()) | !safeEqual(password, credentials.password)) {
    return res.status(401).json({ error: 'Invalid username or password.' });
  }

  cleanupSessions();
  if (sessions.size >= SESSION_MAX) {
    const oldest = sessions.keys().next().value;
    sessions.delete(oldest);
  }

  const token = crypto.randomBytes(32).toString('hex');
  const meta = tracking.getClientMeta(req);
  sessions.set(token, {
    username: credentials.username,
    ip: meta.ip,
    userAgent: meta.userAgent,
    createdAt: Date.now(),
    expiresAt: Date.now() + SESSION_TTL_MS,
  });

  res.cookie(COOKIE_NAME, token, { ...cookieOptions(), maxAge: SESSION_TTL_MS });
  tracking.logAdminEvent(req, { type: 'admin_login', username: credentials.username });

  res.json({ success: true, username: credentials.username });
});

router.use(requireAdmin);

router.get('/me', (req, res) => {
  res.json({
    username: req.admin.username,
    expiresAt: new Date(req.admin.expiresAt).toISOString(),
  });
});

router.post('/logout', (req, res) => {
  const token = parseCookies(req)[COOKIE_NAME];
  if (token) sessions.delete(token);
  res.clearCookie(COOKIE_NAME, cookieOptions());
  tracking.logAdminEvent(req, { type: 'admin_logout', username: req.admin.username });
  res.json({ success: true });
});

router.get('/stats', async (req, res) => {
  try {
    if (statsCache.data && Date.now() < statsCache.expiresAt) {
      return res.json(statsCache.data);
    }

    const today = startOfToday();
    const [postsSnapshot, usersCount, activeTodayCount, activityTodayCount, recentActivity, topUsers, statsSnapshot] =
      await Promise.all([
        db.collection('posts').select('reactions', 'category', 'created_at').get(),
        db.collection('users').count().get(),
        db.collection('users').where('last_seen', '>=', today).count().get(),
        db.collection('activity').where('created_at', '>=', today).count().get(),
        db.collection('activity').orderBy('created_at', 'desc').limit(12).get(),
        db.collection('users').orderBy('posts_count', 'desc').limit(8).get(),
        db.collection('stats').doc('global').get(),
      ]);

    let totalReactions = 0;
    let postsToday = 0;
    const categories = {};

    postsSnapshot.forEach((doc) => {
      const post = doc.data();
      totalReactions += reactionTotal(post.reactions);
      if (post.category) {
        categories[post.category] = (categories[post.category] || 0) + 1;
      }
      const created = toDate(post.created_at);
      if (created && created >= today) postsToday += 1;
    });

    const globalStats = statsSnapshot.exists ? statsSnapshot.data() : {};
    const data = {
      totals: {
        users: usersCount.data().count,
        posts: postsSnapshot.size,
        reactions: totalReactions,
        activeToday: activeTodayCount.data().count,
        postsToday,
        activityToday: activityTodayCount.data().count,
      },
      categories,
      recentActivity: recentActivity.docs.map(serializeDoc),
      topUsers: topUsers.docs.map(serializeDoc),
      lastActivityAt: serializeValue(globalStats.last_activity_at) || null,
      generatedAt: new Date().toISOString(),
    };

    statsCache = { data, expiresAt: Date.now() + STATS_CACHE_MS };
    res.json(data);
  } catch (error) {
    console.error('Admin stats error:', error);
    res.status(500).json({ error: 'Failed to load dashboard stats.' });
  }
});

router.get('/users', async (req, res) => {
  try {
    const snapshot = await db.collection('users').orderBy('last_seen', 'desc').limit(500).get();
    res.json({ items: snapshot.docs.map(serializeDoc) });
  } catch (error) {
    console.error('Admin users error:', error);
    res.status(500).json({ error: 'Failed to load users.' });
  }
});

router.get('/users/:key', async (req, res) => {
  try {
    if (!/^[a-f0-9]{64}$/.test(req.params.key)) {
      return res.status(400).json({ error: 'Invalid user key.' });
    }

    const userDoc = await db.collection('users').doc(req.params.key).get();
    if (!userDoc.exists) {
      return res.status(404).json({ error: 'User not found.' });
    }

    const user = serializeDoc(userDoc);
    const [postsSnapshot, activitySnapshot] = await Promise.all([
      db.collection('posts').where('drinker_id', '==', user.drinker_id).limit(100).get(),
      db.collection('activity').where('drinker_id', '==', user.drinker_id).limit(100).get(),
    ]);

    const posts = postsSnapshot.docs
      .map(serializeDoc)
      .sort(sortByCreatedDesc)
      .slice(0, 25);
    const activity = activitySnapshot.docs
      .map(serializeDoc)
      .sort(sortByCreatedDesc)
      .slice(0, 40);

    res.json({ user, posts, activity });
  } catch (error) {
    console.error('Admin user detail error:', error);
    res.status(500).json({ error: 'Failed to load user details.' });
  }
});

router.get('/activity', async (req, res) => {
  try {
    const snapshot = await db.collection('activity').orderBy('created_at', 'desc').limit(300).get();
    res.json({ items: snapshot.docs.map(serializeDoc) });
  } catch (error) {
    console.error('Admin activity error:', error);
    res.status(500).json({ error: 'Failed to load activity.' });
  }
});

router.get('/posts', async (req, res) => {
  try {
    const snapshot = await db.collection('posts').orderBy('created_at', 'desc').limit(300).get();
    const items = snapshot.docs.map(serializeDoc).map((post) => ({
      ...post,
      reactionTotal: reactionTotal(post.reactions),
    }));
    res.json({ items });
  } catch (error) {
    console.error('Admin posts error:', error);
    res.status(500).json({ error: 'Failed to load posts.' });
  }
});

router.delete('/posts/:id', async (req, res) => {
  try {
    const ref = db.collection('posts').doc(req.params.id);
    const doc = await ref.get();

    if (!doc.exists) {
      return res.status(404).json({ error: 'Post not found.' });
    }

    const post = doc.data();
    await ref.delete();
    await tracking.recordDelete(req, { ...post, id: req.params.id }, true);
    statsCache = { data: null, expiresAt: 0 };

    res.json({ success: true });
  } catch (error) {
    console.error('Admin delete post error:', error);
    res.status(500).json({ error: 'Failed to delete post.' });
  }
});

router.post('/sync', async (req, res) => {
  try {
    const result = await tracking.rebuildFromPosts();
    statsCache = { data: null, expiresAt: 0 };
    res.json({ success: true, ...result });
  } catch (error) {
    console.error('Admin sync error:', error);
    res.status(500).json({ error: 'Failed to rebuild tracking data.' });
  }
});

module.exports = { router, setDb };
