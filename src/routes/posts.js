const express = require('express');
const router = express.Router();
const { corporateFirewall, getClientValidationData } = require('../middleware/corporateFirewall');
const { postLimiter } = require('../middleware/security');

// Supabase client will be injected via middleware
let supabase = null;

function setSupabase(supabaseInstance) {
  supabase = supabaseInstance;
}

/**
 * GET /api/posts
 * Fetch paginated feed posts, optionally filtered by category
 */
router.get('/', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const perPage = parseInt(req.query.perPage) || 20;
    const category = req.query.category || '';

    // Calculate offset for Supabase range (0-indexed, inclusive)
    const from = (page - 1) * perPage;
    const to = from + perPage - 1;

    // Build query
    let query = supabase
      .from('posts')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to);

    // Apply category filter
    if (category && category !== 'all') {
      query = query.eq('category', category);
    }

    const { data, error, count } = await query;

    if (error) throw error;

    const totalPages = Math.ceil((count || 0) / perPage);

    res.json({
      items: (data || []).map(formatPost),
      page: page,
      perPage: perPage,
      totalItems: count || 0,
      totalPages: totalPages,
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
      drinker_id: drinker_id,
      drinker_name: is_anonymous ? 'Anonymous Drinker' : drinker_name,
      content: content,
      category: category,
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
    };

    const { data, error } = await supabase
      .from('posts')
      .insert(postData)
      .select()
      .single();

    if (error) throw error;

    const response = {
      success: true,
      post: formatPost(data),
    };

    // Attach corporate warning if any (Tier 2/3 soft warning)
    if (req.corporateWarning) {
      response.warning = req.corporateWarning;
    }

    res.status(201).json(response);
  } catch (error) {
    console.error('Error creating post:', error);
    res.status(500).json({ error: 'Failed to create post. The server spilled its drink. 🍻' });
  }
});

/**
 * POST /api/posts/:id/react
 * Add a reaction to a post
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

    // Fetch current post
    const { data: post, error: fetchError } = await supabase
      .from('posts')
      .select('reactions')
      .eq('id', id)
      .single();

    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        return res.status(404).json({ error: 'Post not found. It probably sobered up and deleted itself.' });
      }
      throw fetchError;
    }

    let reactions = post.reactions || { cheers: 0, oof: 0, tea: 0, same: 0, therapy: 0, hr_risk: 0 };

    // Increment reaction
    reactions[reaction] = (reactions[reaction] || 0) + 1;

    // Update post
    const { data: updated, error: updateError } = await supabase
      .from('posts')
      .update({ reactions })
      .eq('id', id)
      .select('reactions')
      .single();

    if (updateError) throw updateError;

    res.json({
      success: true,
      reactions: updated.reactions,
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

    // Verify ownership
    const { data: post, error: fetchError } = await supabase
      .from('posts')
      .select('drinker_id')
      .eq('id', id)
      .single();

    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        return res.status(404).json({ error: 'Post not found. Already gone, like your motivation on Monday.' });
      }
      throw fetchError;
    }

    if (post.drinker_id !== drinker_id) {
      return res.status(403).json({
        error: "That's not your post to delete. Nice try though. 🕵️",
      });
    }

    const { error: deleteError } = await supabase
      .from('posts')
      .delete()
      .eq('id', id);

    if (deleteError) throw deleteError;

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

  return {
    id: record.id,
    drinker_id: record.drinker_id,
    drinker_name: record.drinker_name,
    content: record.content,
    category: record.category,
    is_anonymous: record.is_anonymous,
    company_type: record.company_type || '',
    reactions: reactions,
    created: record.created_at,
  };
}

module.exports = { router, setSupabase };
