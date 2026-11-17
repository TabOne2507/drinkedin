/**
 * DrinkedIn - Public aggregate stats
 * Only anonymous counts are exposed; no user data leaves this endpoint.
 */

const express = require('express');

const router = express.Router();

let db = null;
let cache = { data: null, expiresAt: 0 };
const CACHE_TTL_MS = 60 * 1000;

function setDb(firestoreInstance) {
  db = firestoreInstance;
}

function startOfToday() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

router.get('/', async (req, res) => {
  try {
    if (cache.data && Date.now() < cache.expiresAt) {
      return res.json(cache.data);
    }

    const [statsSnapshot, postsCount, usersCount, todayCount] = await Promise.all([
      db.collection('stats').doc('global').get(),
      db.collection('posts').count().get(),
      db.collection('users').count().get(),
      db.collection('posts').where('created_at', '>=', startOfToday()).count().get(),
    ]);

    const globalStats = statsSnapshot.exists ? statsSnapshot.data() : {};
    const data = {
      users: usersCount.data().count,
      posts: postsCount.data().count,
      reactions: globalStats.total_reactions || 0,
      postsToday: todayCount.data().count,
    };

    cache = { data, expiresAt: Date.now() + CACHE_TTL_MS };
    res.json(data);
  } catch (error) {
    console.error('Error fetching public stats:', error);
    res.status(500).json({ error: 'Could not load bar stats.' });
  }
});

module.exports = { router, setDb };
