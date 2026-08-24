const express = require('express');
const admin = require('firebase-admin');
const router = express.Router();
const { corporateFirewall, getClientValidationData } = require('../middleware/corporateFirewall');
const { postLimiter } = require('../middleware/security');

// Firestore instance will be injected via setter
let db = null;

function setDb(firestoreInstance) {
  db = firestoreInstance;
}

const COLLECTION = 'posts';

/**
 * GET /api/posts
 * Fetch paginated feed posts, optionally filtered by category
 */
router.get('/', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const perPage = parseInt(req.query.perPage) || 20;
    const category = req.query.category || '';

    let query = db.collection(COLLECTION).orderBy('created_at', 'desc');

    // Apply category filter
    if (category && category !== 'all') {
      query = query.where('category', '==', category);
    }

    // Get total count
    const countSnapshot = await query.get();
    const totalItems = countSnapshot.size;
    const totalPages = Math.ceil(totalItems / perPage);

    // Apply pagination using cursor-based approach
    if (page > 1) {
      const skipCount = (page - 1) * perPage;
      let prevQuery = db.collection(COLLECTION).orderBy('created_at', 'desc');
      if (category && category !== 'all') {
        prevQuery = prevQuery.where('category', '==', category);
      }
      const prevPageSnapshot = await prevQuery.limit(skipCount).get();

      if (prevPageSnapshot.docs.length > 0) {
        const lastVisible = prevPageSnapshot.docs[prevPageSnapshot.docs.length - 1];
        query = query.startAfter(lastVisible);
      }
    }

    const snapshot = await query.limit(perPage).get();
    const items = snapshot.docs.map(doc => formatPost({ id: doc.id, ...doc.data() }));

    res.json({
      items,
      page,
      perPage,
      totalItems,
      totalPages,
    });
  } catch (error) {
    console.error('Error fetching posts:', error);
    res.status(500).json({ error: 'Failed to fetch posts. The server is probably hungover too. 🍺' });
  }
});

/**
 * POST /api/posts
 * Create a new post (with Corporate Firewall™ check)
 */
router.post('/', postLimiter, corporateFirewall, async (req, res) => {
  try {
    const { drinker_id, drinker_name, content, category, is_anonymous, company_type } = req.body;

    // Validate required fields
    if (!drinker_id || !content || !category) {
      return res.status(400).json({
        error: 'Missing required fields. Even drunk posts need some effort.',
      });
    }

    if (!drinker_name) {
      return res.status(400).json({
        error: 'Who are you? Enter a drinker name first.',
      });
    }

    // Validate category
    const validCategories = ['morning_after', 'office_rage', 'personal_overshare', 'industry_gossip', 'water_cooler'];
    if (!validCategories.includes(category)) {
      return res.status(400).json({
        error: 'Invalid category. Pick a valid type of chaos.',
      });
    }

    // Validate content length
    if (content.length < 3) {
      return res.status(400).json({
        error: 'Post too short. Even a grunt needs at least 3 characters.',
      });
    }

    if (content.length > 3000) {
      return res.status(400).json({
        error: 'Post too long. Save some rage for tomorrow.',
      });
    }

    const postData = {
      drinker_id,
      drinker_name: is_anonymous ? 'Anonymous Drinker' : drinker_name,
      content,
      category,
      is_anonymous: !!is_anonymous,
      company_type: company_type || '',
      reactions: {
        cheers: 0,
        oof: 0,
        tea: 0,
        same: 0,
        therapy: 0,
        hr_risk: 0,
      },
      created_at: admin.firestore.FieldValue.serverTimestamp(),
    };

    const docRef = await db.collection(COLLECTION).add(postData);
    const doc = await docRef.get();

    const response = {
      success: true,
      post: formatPost({ id: doc.id, ...doc.data() }),
    };

    // Attach corporate warning if any (Tier 2/3 soft warning)
    if (req.corporateWarning) {
      response.warning = req.corporateWarning;
    }

    res.status(201).json(response);
  } catch (error) {
    console.error('Error creating post:', error.message || error);
    res.status(500).json({ error: 'Failed to create post. The server spilled its drink. 🍻' });
  }
});

/**
 * POST /api/posts/:id/react
 * Add a reaction to a post (using atomic increment)
 */
router.post('/:id/react', async (req, res) => {
  try {
    const { id } = req.params;
    const { reaction } = req.body;

    const validReactions = ['cheers', 'oof', 'tea', 'same', 'therapy', 'hr_risk'];
    if (!validReactions.includes(reaction)) {
      return res.status(400).json({
        error: 'Invalid reaction. Choose a valid emotional response.',
      });
    }

    const postRef = db.collection(COLLECTION).doc(id);
    const postDoc = await postRef.get();

    if (!postDoc.exists) {
      return res.status(404).json({ error: 'Post not found. It probably sobered up and deleted itself.' });
    }

    // Atomic increment — no race condition
    await postRef.update({
      [`reactions.${reaction}`]: admin.firestore.FieldValue.increment(1),
    });

    // Fetch updated document to return new reaction counts
    const updatedDoc = await postRef.get();
    const reactions = updatedDoc.data().reactions || {
      cheers: 0, oof: 0, tea: 0, same: 0, therapy: 0, hr_risk: 0,
    };

    res.json({
      success: true,
      reactions,
    });
  } catch (error) {
    console.error('Error adding reaction:', error);
    res.status(500).json({ error: 'Failed to react. Try screaming into a pillow instead.' });
  }
});

/**
 * DELETE /api/posts/:id
 * Delete a post (only by the original poster via drinker_id match)
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { drinker_id } = req.body;

    if (!drinker_id) {
      return res.status(400).json({ error: 'Authentication required. Who even are you?' });
    }

    const postRef = db.collection(COLLECTION).doc(id);
    const postDoc = await postRef.get();

    if (!postDoc.exists) {
      return res.status(404).json({ error: 'Post not found. Already gone, like your motivation on Monday.' });
    }

    if (postDoc.data().drinker_id !== drinker_id) {
      return res.status(403).json({
        error: "That's not your post to delete. Nice try though. 🕵️",
      });
    }

    await postRef.delete();

    res.json({ success: true, message: 'Post deleted. Like it never happened. 🫣' });
  } catch (error) {
    console.error('Error deleting post:', error);
    res.status(500).json({ error: 'Failed to delete post. The server is uncooperative.' });
  }
});

/**
 * GET /api/corporate-firewall/rules
 * Returns client-side validation patterns for pre-checking
 */
router.get('/corporate-firewall/rules', (req, res) => {
  res.json(getClientValidationData());
});

/**
 * Format a post record for API response
 */
function formatPost(record) {
  let reactions = { cheers: 0, oof: 0, tea: 0, same: 0, therapy: 0, hr_risk: 0 };
  try {
    reactions = typeof record.reactions === 'string' ? JSON.parse(record.reactions) : (record.reactions || reactions);
  } catch {
    // Keep defaults
  }

  // Handle Firestore Timestamp objects
  let created = record.created_at;
  if (created && typeof created.toDate === 'function') {
    created = created.toDate().toISOString();
  }

  return {
    id: record.id,
    drinker_id: record.drinker_id,
    drinker_name: record.drinker_name,
    content: record.content,
    category: record.category,
    is_anonymous: record.is_anonymous,
    company_type: record.company_type || '',
    reactions,
    created,
  };
}

module.exports = { router, setDb };
