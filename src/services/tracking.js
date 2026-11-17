/**
 * DrinkedIn - Activity Tracking Service
 *
 * Stores per-user aggregates and an activity event log in Firestore so the
 * admin dashboard can report on real usage. Every public function swallows
 * its own errors: tracking must never break the main request flow.
 */

const crypto = require('crypto');
const admin = require('firebase-admin');

const USERS_COLLECTION = 'users';
const ACTIVITY_COLLECTION = 'activity';
const POSTS_COLLECTION = 'posts';

let db = null;

function setDb(firestoreInstance) {
  db = firestoreInstance;
}

function userKey(drinkerId) {
  return crypto.createHash('sha256').update(String(drinkerId)).digest('hex');
}

function getClientMeta(req) {
  const forwarded = req.headers['x-forwarded-for'];
  const rawIp = forwarded ? forwarded.split(',')[0] : req.ip;
  const ip = String(rawIp || '').trim().slice(0, 100);
  const userAgent = String(req.headers['user-agent'] || '').slice(0, 500);
  return { ip, userAgent };
}

function preview(text, max = 240) {
  const clean = String(text || '').replace(/\s+/g, ' ').trim();
  if (!clean) return '';
  return clean.length > max ? `${clean.slice(0, max)}…` : clean;
}

function reactionTotal(reactions) {
  if (!reactions || typeof reactions !== 'object') return 0;
  return Object.values(reactions).reduce((sum, count) => sum + (Number(count) || 0), 0);
}

function toDate(value) {
  if (!value) return null;
  if (typeof value.toDate === 'function') return value.toDate();
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function statsRef() {
  return db.collection('stats').doc('global');
}

function activityRef() {
  return db.collection(ACTIVITY_COLLECTION).doc();
}

function cleanName(name) {
  return String(name || 'Anonymous Drinker').slice(0, 80);
}

function baseUserFields(drinkerId, drinkerName, meta) {
  return {
    drinker_id: String(drinkerId),
    drinker_name: cleanName(drinkerName),
    last_seen: admin.firestore.FieldValue.serverTimestamp(),
    last_ip: meta.ip,
    last_user_agent: meta.userAgent,
  };
}

/**
 * Record a drinker entering the app. `resumed` is true when an existing
 * browser session is restored, which updates last_seen without inflating
 * the session counter.
 */
async function recordSession(req, { drinker_id, drinker_name, resumed }) {
  if (!db || !drinker_id) return;

  try {
    const meta = getClientMeta(req);
    const ref = db.collection(USERS_COLLECTION).doc(userKey(drinker_id));
    const snapshot = await ref.get();
    const isNew = !snapshot.exists;
    const update = baseUserFields(drinker_id, drinker_name, meta);

    if (isNew) {
      update.first_seen = admin.firestore.FieldValue.serverTimestamp();
      update.sessions = 1;
    } else if (!resumed) {
      update.sessions = admin.firestore.FieldValue.increment(1);
    }

    await ref.set(update, { merge: true });

    if (!resumed) {
      const batch = db.batch();
      batch.set(statsRef(), {
        total_sessions: admin.firestore.FieldValue.increment(1),
        last_activity_at: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });
      batch.set(activityRef(), {
        type: 'session_started',
        drinker_id: String(drinker_id),
        drinker_name: cleanName(drinker_name),
        ip: meta.ip,
        user_agent: meta.userAgent,
        created_at: admin.firestore.FieldValue.serverTimestamp(),
      });
      await batch.commit();
    }
  } catch (error) {
    console.error('Tracking session failed:', error.message);
  }
}

/**
 * Record a newly created post.
 */
async function recordPost(req, { post, authorId, authorName, isAnonymous, companyType }) {
  if (!db || !post || !authorId) return;

  try {
    const meta = getClientMeta(req);
    const ref = db.collection(USERS_COLLECTION).doc(userKey(authorId));
    const snapshot = await ref.get();
    const userUpdate = baseUserFields(authorId, authorName, meta);

    userUpdate.last_category = post.category || '';
    userUpdate.last_company_type = companyType || '';
    userUpdate.posts_count = admin.firestore.FieldValue.increment(1);
    if (isAnonymous) {
      userUpdate.anonymous_posts = admin.firestore.FieldValue.increment(1);
    }
    if (!snapshot.exists) {
      userUpdate.first_seen = admin.firestore.FieldValue.serverTimestamp();
    }

    const statsUpdate = {
      total_posts: admin.firestore.FieldValue.increment(1),
      last_activity_at: admin.firestore.FieldValue.serverTimestamp(),
    };
    if (post.category) {
      statsUpdate[`categories.${post.category}`] = admin.firestore.FieldValue.increment(1);
    }

    const batch = db.batch();
    batch.set(ref, userUpdate, { merge: true });
    batch.set(statsRef(), statsUpdate, { merge: true });
    batch.set(activityRef(), {
      type: 'post_created',
      drinker_id: String(authorId),
      drinker_name: cleanName(authorName),
      post_id: post.id,
      category: post.category || '',
      content_preview: preview(post.content),
      is_anonymous: !!isAnonymous,
      ip: meta.ip,
      user_agent: meta.userAgent,
      created_at: admin.firestore.FieldValue.serverTimestamp(),
    });
    await batch.commit();
  } catch (error) {
    console.error('Tracking post failed:', error.message);
  }
}

/**
 * Record a reaction. The client sends its drinker identity with the click.
 */
async function recordReaction(req, { post, reaction, drinkerId, drinkerName }) {
  if (!db) return;

  try {
    const meta = getClientMeta(req);
    const batch = db.batch();

    if (drinkerId) {
      const ref = db.collection(USERS_COLLECTION).doc(userKey(drinkerId));
      const snapshot = await ref.get();
      const userUpdate = baseUserFields(drinkerId, drinkerName, meta);
      userUpdate.reactions_given = admin.firestore.FieldValue.increment(1);
      if (post && post.category) userUpdate.last_category = post.category;
      if (!snapshot.exists) {
        userUpdate.first_seen = admin.firestore.FieldValue.serverTimestamp();
      }
      batch.set(ref, userUpdate, { merge: true });
    }

    batch.set(statsRef(), {
      total_reactions: admin.firestore.FieldValue.increment(1),
      last_activity_at: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });

    batch.set(activityRef(), {
      type: 'reaction_added',
      drinker_id: drinkerId ? String(drinkerId) : '',
      drinker_name: cleanName(drinkerName),
      post_id: post ? post.id : '',
      category: post ? post.category || '' : '',
      reaction: reaction || '',
      content_preview: post ? preview(post.content) : '',
      ip: meta.ip,
      user_agent: meta.userAgent,
      created_at: admin.firestore.FieldValue.serverTimestamp(),
    });
    await batch.commit();
  } catch (error) {
    console.error('Tracking reaction failed:', error.message);
  }
}

/**
 * Record a deleted post and update aggregate counters.
 */
async function recordDelete(req, post, deletedByAdmin = false) {
  if (!db || !post) return;

  try {
    const meta = getClientMeta(req);
    const batch = db.batch();

    if (post.drinker_id) {
      const ref = db.collection(USERS_COLLECTION).doc(userKey(post.drinker_id));
      const snapshot = await ref.get();
      const userUpdate = {
        last_seen: admin.firestore.FieldValue.serverTimestamp(),
        posts_deleted: admin.firestore.FieldValue.increment(1),
      };

      if (snapshot.exists) {
        userUpdate.posts_count = admin.firestore.FieldValue.increment(-1);
      } else {
        userUpdate.drinker_id = String(post.drinker_id);
        userUpdate.drinker_name = cleanName(post.drinker_name);
        userUpdate.first_seen = admin.firestore.FieldValue.serverTimestamp();
        userUpdate.posts_count = 0;
      }
      batch.set(ref, userUpdate, { merge: true });
    }

    const statsUpdate = {
      total_posts: admin.firestore.FieldValue.increment(-1),
      total_reactions: admin.firestore.FieldValue.increment(-reactionTotal(post.reactions)),
      last_activity_at: admin.firestore.FieldValue.serverTimestamp(),
    };
    if (post.category) {
      statsUpdate[`categories.${post.category}`] = admin.firestore.FieldValue.increment(-1);
    }

    batch.set(statsRef(), statsUpdate, { merge: true });
    batch.set(activityRef(), {
      type: deletedByAdmin ? 'admin_post_deleted' : 'post_deleted',
      drinker_id: post.drinker_id ? String(post.drinker_id) : '',
      drinker_name: cleanName(post.drinker_name),
      post_id: post.id,
      category: post.category || '',
      content_preview: preview(post.content),
      ip: meta.ip,
      user_agent: meta.userAgent,
      created_at: admin.firestore.FieldValue.serverTimestamp(),
    });
    await batch.commit();
  } catch (error) {
    console.error('Tracking delete failed:', error.message);
  }
}

/**
 * Record an admin login/logout event.
 */
async function logAdminEvent(req, { type, username }) {
  if (!db) return;

  try {
    const meta = getClientMeta(req);
    await db.collection(ACTIVITY_COLLECTION).add({
      type,
      drinker_id: `admin:${username}`,
      drinker_name: username,
      ip: meta.ip,
      user_agent: meta.userAgent,
      created_at: admin.firestore.FieldValue.serverTimestamp(),
    });
  } catch (error) {
    console.error('Tracking admin event failed:', error.message);
  }
}

/**
 * Rebuild user aggregates and global counters from the posts collection.
 * Used on first boot and by the admin "Rebuild" button.
 */
async function rebuildFromPosts() {
  if (!db) return { posts: 0, users: 0 };

  try {
    const postsSnapshot = await db.collection(POSTS_COLLECTION).get();
    const users = new Map();
    const categories = {};
    let totalReactions = 0;

    postsSnapshot.forEach((doc) => {
      const post = doc.data();
      if (!post.drinker_id) return;

      const created = toDate(post.created_at);
      const id = String(post.drinker_id);
      let user = users.get(id);

      if (!user) {
        user = {
          drinker_id: id,
          drinker_name: '',
          posts_count: 0,
          anonymous_posts: 0,
          first_seen: created,
          last_seen: created,
          last_category: post.category || '',
          last_company_type: post.company_type || '',
          nameAt: null,
        };
        users.set(id, user);
      }

      user.posts_count += 1;
      if (post.is_anonymous) user.anonymous_posts += 1;

      if (created) {
        if (!user.first_seen || created < user.first_seen) user.first_seen = created;
        if (!user.last_seen || created > user.last_seen) {
          user.last_seen = created;
          user.last_category = post.category || '';
          user.last_company_type = post.company_type || '';
        }
      }

      if (!post.is_anonymous && post.drinker_name) {
        if (!user.nameAt || (created && created >= user.nameAt)) {
          user.drinker_name = String(post.drinker_name).slice(0, 80);
          user.nameAt = created;
        }
      }

      if (post.category) {
        categories[post.category] = (categories[post.category] || 0) + 1;
      }
      totalReactions += reactionTotal(post.reactions);
    });

    // Read existing docs in chunks so we never move first_seen/last_seen
    // backwards for users that already have tracked sessions.
    const entries = Array.from(users.values());
    const writes = [];

    for (let i = 0; i < entries.length; i += 100) {
      const chunk = entries.slice(i, i + 100);
      const snapshots = await Promise.all(
        chunk.map((user) => db.collection(USERS_COLLECTION).doc(userKey(user.drinker_id)).get())
      );

      chunk.forEach((user, index) => {
        const snapshot = snapshots[index];
        const existing = snapshot.exists ? snapshot.data() : {};
        const existingFirst = toDate(existing.first_seen);
        const existingLast = toDate(existing.last_seen);

        const data = {
          drinker_id: user.drinker_id,
          posts_count: user.posts_count,
          anonymous_posts: user.anonymous_posts,
          last_category: user.last_category,
          last_company_type: user.last_company_type,
          updated_at: admin.firestore.FieldValue.serverTimestamp(),
        };

        if (user.drinker_name) data.drinker_name = user.drinker_name;

        data.first_seen = existingFirst && (!user.first_seen || existingFirst < user.first_seen)
          ? existingFirst
          : (user.first_seen || admin.firestore.FieldValue.serverTimestamp());
        data.last_seen = existingLast && (!user.last_seen || existingLast > user.last_seen)
          ? existingLast
          : (user.last_seen || admin.firestore.FieldValue.serverTimestamp());

        writes.push({
          ref: db.collection(USERS_COLLECTION).doc(userKey(user.drinker_id)),
          data,
        });
      });
    }

    for (let i = 0; i < writes.length; i += 400) {
      const batch = db.batch();
      writes.slice(i, i + 400).forEach(({ ref, data }) => batch.set(ref, data, { merge: true }));
      await batch.commit();
    }

    const [statsSnapshot, usersCount] = await Promise.all([
      statsRef().get(),
      db.collection(USERS_COLLECTION).count().get(),
    ]);
    const existingStats = statsSnapshot.exists ? statsSnapshot.data() : {};
    const allCategories = ['morning_after', 'office_rage', 'personal_overshare', 'industry_gossip', 'water_cooler'];
    const categoryCounts = {};
    allCategories.forEach((category) => {
      categoryCounts[category] = categories[category] || 0;
    });

    await statsRef().set({
      total_posts: postsSnapshot.size,
      total_reactions: totalReactions,
      total_users: usersCount.data().count,
      total_sessions: existingStats.total_sessions || 0,
      categories: categoryCounts,
      rebuilt_at: admin.firestore.FieldValue.serverTimestamp(),
      last_activity_at: existingStats.last_activity_at || admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });

    return { posts: postsSnapshot.size, users: users.size };
  } catch (error) {
    console.error('Tracking rebuild failed:', error.message);
    return { posts: 0, users: 0, error: error.message };
  }
}

/**
 * Populate tracking data for existing deployments on first boot.
 */
async function initialize() {
  if (!db) return;

  try {
    const [statsSnapshot, usersCount] = await Promise.all([
      statsRef().get(),
      db.collection(USERS_COLLECTION).count().get(),
    ]);

    if (!statsSnapshot.exists || usersCount.data().count === 0) {
      const result = await rebuildFromPosts();
      console.log(`Tracking initialized: ${result.users} users, ${result.posts} posts.`);
    }
  } catch (error) {
    console.error('Tracking initialization failed:', error.message);
  }
}

module.exports = {
  setDb,
  initialize,
  rebuildFromPosts,
  recordSession,
  recordPost,
  recordReaction,
  recordDelete,
  logAdminEvent,
  getClientMeta,
  userKey,
};
