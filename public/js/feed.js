/**
 * DrinkedIn - Feed Module
 * Handles loading, rendering, and managing feed posts
 */

const Feed = (() => {
  let currentPosts = [];
  let hasMorePages = false;

  // Category display info
  const CATEGORY_INFO = {
    morning_after: { emoji: '🌅', label: 'Morning After Confession', color: '#f59e0b' },
    office_rage: { emoji: '😤', label: 'Office Rage Vent', color: '#ef4444' },
    personal_overshare: { emoji: '🫣', label: 'Personal Overshare', color: '#a855f7' },
    industry_gossip: { emoji: '🍵', label: 'Industry Gossip', color: '#10b981' },
    water_cooler: { emoji: '💧', label: 'Water Cooler Random', color: '#3b82f6' },
  };

  // Sample posts for when PocketBase is unavailable (demo/fallback)
  const SAMPLE_POSTS = [
    {
      id: 'sample-1',
      drinker_name: 'BeerLord#42',
      drinker_id: 'BeerLord#42_143052_11042026',
      content: 'My manager just used the phrase "let\'s circle back on this" for the 7th time today. SEVENTH. I started a tally. Send help. Or whiskey. Preferably whiskey. 🥃',
      category: 'office_rage',
      is_anonymous: false,
      company_type: '',
      reactions: { cheers: 24, oof: 47, tea: 3, same: 89, therapy: 12, hr_risk: 5 },
      created: new Date(Date.now() - 3600000).toISOString(),
    },
    {
      id: 'sample-2',
      drinker_name: 'Anonymous Drinker',
      drinker_id: 'anon',
      content: 'Just came back from a "quick coffee catch-up" that turned into 3 hours at the pub. Called in sick for the afternoon meeting. No regrets. My VP was also at the pub. We made eye contact. Neither of us will speak of this.',
      category: 'morning_after',
      is_anonymous: true,
      company_type: 'Finance Firm',
      reactions: { cheers: 156, oof: 12, tea: 67, same: 203, therapy: 4, hr_risk: 34 },
      created: new Date(Date.now() - 7200000).toISOString(),
    },
    {
      id: 'sample-3',
      drinker_name: 'CoffeAddict!!',
      drinker_id: 'CoffeAddict!!_090034_11042026',
      content: 'Started dating someone from the office. We both pretend we don\'t know each other in meetings. Yesterday, she presented MY slides. I had to sit there and clap. This is fine. Everything is fine. 🙃',
      category: 'personal_overshare',
      is_anonymous: false,
      company_type: '',
      reactions: { cheers: 45, oof: 89, tea: 234, same: 67, therapy: 23, hr_risk: 156 },
      created: new Date(Date.now() - 14400000).toISOString(),
    },
    {
      id: 'sample-4',
      drinker_name: 'Anonymous Drinker',
      drinker_id: 'anon',
      content: 'CONFIRMED: The Big 4 firm with the worst coffee is [REDACTED] Deloitte. Their break room coffee tastes like someone brewed it in 2019 and just kept reheating it. The partners still drink it like it\'s liquid gold. Stockholm syndrome is real.',
      category: 'industry_gossip',
      is_anonymous: true,
      company_type: 'Consulting Agency',
      reactions: { cheers: 78, oof: 23, tea: 412, same: 156, therapy: 5, hr_risk: 8 },
      created: new Date(Date.now() - 28800000).toISOString(),
    },
    {
      id: 'sample-5',
      drinker_name: 'NightOwl$$99',
      drinker_id: 'NightOwl$$99_232145_10042026',
      content: 'Hot take: The office microwave fish person is the bravest soul in corporate America. While you\'re worried about what Karen in accounting thinks of your email tone, that absolute LEGEND is heating up salmon at 12:30pm. Unmatched energy.',
      category: 'water_cooler',
      is_anonymous: false,
      company_type: '',
      reactions: { cheers: 312, oof: 45, tea: 12, same: 178, therapy: 2, hr_risk: 1 },
      created: new Date(Date.now() - 43200000).toISOString(),
    },
    {
      id: 'sample-6',
      drinker_name: 'Anonymous Drinker',
      drinker_id: 'anon',
      content: 'Tonight\'s poison: 4 margaritas and a conversation with my Uber driver that was more meaningful than any 1:1 with my manager this quarter. Rating: 🌶️🌶️🌶️ spicy on the hangover scale. Might call in sick. Might also cry in the shower. TBD.',
      category: 'morning_after',
      is_anonymous: true,
      company_type: 'Tech Company',
      reactions: { cheers: 198, oof: 67, tea: 5, same: 289, therapy: 45, hr_risk: 3 },
      created: new Date(Date.now() - 54000000).toISOString(),
    },
    {
      id: 'sample-7',
      drinker_name: 'RebelDev@#77',
      drinker_id: 'RebelDev@#77_101530_11042026',
      content: 'My coworker just cc\'d the ENTIRE COMPANY on a reply-all about the broken espresso machine. 847 employees now know that "this is UNACCEPTABLE and reflects a systemic failure in office resource management." King behavior honestly. The CEO replied with a single emoji: 👍',
      category: 'office_rage',
      is_anonymous: false,
      company_type: '',
      reactions: { cheers: 534, oof: 123, tea: 89, same: 267, therapy: 12, hr_risk: 78 },
      created: new Date(Date.now() - 72000000).toISOString(),
    },
    {
      id: 'sample-8',
      drinker_name: 'MadMax!!2026',
      drinker_id: 'MadMax!!2026_141200_10042026',
      content: 'My therapist told me to "set boundaries at work." So I moved my desk to the parking lot. Working from my car now. HR called. I told them it\'s a "mobile office initiative." They\'re considering approving a budget for it. The system is broken and I AM THE GLITCH.',
      category: 'personal_overshare',
      is_anonymous: false,
      company_type: '',
      reactions: { cheers: 890, oof: 34, tea: 23, same: 456, therapy: 234, hr_risk: 67 },
      created: new Date(Date.now() - 86400000).toISOString(),
    },
  ];

  /**
   * Load posts from API (with fallback to sample data)
   */
  async function loadPosts(category = 'all', page = 1, append = false) {
    const feedContainer = document.getElementById('feedPosts');
    const loadMoreBtn = document.getElementById('loadMoreBtn');

    if (!feedContainer) return;

    // Show loading skeleton if first page
    if (!append) {
      feedContainer.innerHTML = renderSkeletons(3);
    }

    // Try API first
    const result = await App.apiRequest(`/api/posts?category=${category}&page=${page}&perPage=20`);

    let posts;
    if (result.error) {
      // Fallback to sample data
      posts = filterSamplePosts(category);
      hasMorePages = false;
    } else {
      posts = result.data.items;
      hasMorePages = page < result.data.totalPages;
    }

    if (append) {
      currentPosts = [...currentPosts, ...posts];
    } else {
      currentPosts = posts;
    }

    // Render posts
    if (currentPosts.length === 0) {
      feedContainer.innerHTML = renderEmptyState(category);
    } else {
      if (append) {
        const newHtml = posts.map((post, i) => renderPost(post, currentPosts.length - posts.length + i)).join('');
        feedContainer.insertAdjacentHTML('beforeend', newHtml);
      } else {
        feedContainer.innerHTML = currentPosts.map((post, i) => renderPost(post, i)).join('');
      }
    }

    // Show/hide load more button
    if (loadMoreBtn) {
      loadMoreBtn.classList.toggle('hidden', !hasMorePages);
    }

    // Attach reaction listeners to new posts
    Reactions.attachListeners();
  }

  /**
   * Filter sample posts by category
   */
  function filterSamplePosts(category) {
    if (category === 'all') return SAMPLE_POSTS;
    return SAMPLE_POSTS.filter(p => p.category === category);
  }

  /**
   * Render a single post card
   */
  function renderPost(post, index) {
    const catInfo = CATEGORY_INFO[post.category] || { emoji: '💬', label: 'Post', color: '#f5a801' };
    const isAnon = post.is_anonymous;
    const displayName = isAnon ? 'Anonymous Drinker' : post.drinker_name;
    const anonSuffix = isAnon && post.company_type ? ` at ${post.company_type}` : '';
    const initial = isAnon ? '🕶️' : (displayName[0] || '?').toUpperCase();
    const timeAgo = formatTimeAgo(post.created);
    const reactions = post.reactions || { cheers: 0, oof: 0, tea: 0, same: 0, therapy: 0, hr_risk: 0 };
    const totalReactions = Object.values(reactions).reduce((a, b) => a + b, 0);
    const animDelay = Math.min(index * 0.07, 0.5);

    // Get top 3 reaction emojis
    const reactionEmojis = getTopReactionEmojis(reactions);

    // Check if current user owns this post
    const currentState = App.getState();
    const isOwner = currentState.drinkerId === post.drinker_id;

    return `
      <article class="feed-post" data-post-id="${post.id}" style="animation-delay: ${animDelay}s">
        <div class="post-header">
          <div class="post-avatar ${isAnon ? 'anonymous' : ''}">${initial}</div>
          <div class="post-meta">
            <div class="post-author">${escapeHtml(displayName)}${anonSuffix ? `<span style="color:var(--text-tertiary);font-weight:400;font-size:0.8rem"> ${escapeHtml(anonSuffix)}</span>` : ''}</div>
            <div class="post-subtitle">
              <span class="post-category-badge">${catInfo.emoji} ${catInfo.label}</span>
              <span class="post-time">· ${timeAgo}</span>
            </div>
          </div>
          ${isOwner ? `<button class="post-menu-btn" data-action="delete" data-post-id="${post.id}" title="Delete post">🗑️</button>` : ''}
        </div>
        <div class="post-content">${escapeHtml(post.content)}</div>
        ${totalReactions > 0 ? `
          <div class="post-reactions-summary">
            <div class="reaction-emoji-stack">${reactionEmojis}</div>
            <span>${totalReactions} reactions</span>
          </div>
        ` : ''}
        <div class="post-actions" data-post-id="${post.id}">
          <button class="post-action-btn" data-reaction="cheers">
            <span class="reaction-icon">🍻</span>
            <span>Cheers</span>
            <span class="reaction-count">${reactions.cheers || ''}</span>
          </button>
          <button class="post-action-btn" data-reaction="oof">
            <span class="reaction-icon">😬</span>
            <span>Oof</span>
            <span class="reaction-count">${reactions.oof || ''}</span>
          </button>
          <button class="post-action-btn" data-reaction="tea">
            <span class="reaction-icon">🍵</span>
            <span>Tea</span>
            <span class="reaction-count">${reactions.tea || ''}</span>
          </button>
          <button class="post-action-btn" data-reaction="same">
            <span class="reaction-icon">🤝</span>
            <span>Same</span>
            <span class="reaction-count">${reactions.same || ''}</span>
          </button>
          <button class="post-action-btn" data-reaction="therapy">
            <span class="reaction-icon">🛋️</span>
            <span>Therapy</span>
            <span class="reaction-count">${reactions.therapy || ''}</span>
          </button>
          <button class="post-action-btn" data-reaction="hr_risk">
            <span class="reaction-icon">🚨</span>
            <span>HR Risk</span>
            <span class="reaction-count">${reactions.hr_risk || ''}</span>
          </button>
        </div>
      </article>
    `;
  }

  /**
   * Get top reaction emojis for summary display
   */
  function getTopReactionEmojis(reactions) {
    const emojiMap = {
      cheers: '🍻', oof: '😬', tea: '🍵',
      same: '🤝', therapy: '🛋️', hr_risk: '🚨',
    };

    return Object.entries(reactions)
      .filter(([, count]) => count > 0)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([key]) => `<span>${emojiMap[key]}</span>`)
      .join('');
  }

  /**
   * Render loading skeletons
   */
  function renderSkeletons(count) {
    let html = '';
    for (let i = 0; i < count; i++) {
      html += `
        <div class="skeleton-post">
          <div class="skeleton-header">
            <div class="skeleton skeleton-avatar"></div>
            <div class="skeleton-lines">
              <div class="skeleton skeleton-line medium"></div>
              <div class="skeleton skeleton-line short"></div>
            </div>
          </div>
          <div class="skeleton-body">
            <div class="skeleton skeleton-line long"></div>
            <div class="skeleton skeleton-line long"></div>
            <div class="skeleton skeleton-line medium"></div>
          </div>
        </div>
      `;
    }
    return html;
  }

  /**
   * Render empty state
   */
  function renderEmptyState(category) {
    const catInfo = CATEGORY_INFO[category];
    const emoji = catInfo ? catInfo.emoji : '🍺';
    const label = catInfo ? catInfo.label : 'posts';

    return `
      <div class="empty-state">
        <div class="empty-state-icon">${emoji}</div>
        <div class="empty-state-title">No ${label} yet</div>
        <div class="empty-state-text">
          Be the first to post something. The bar's empty and we need some chaos in here.
        </div>
      </div>
    `;
  }

  /**
   * Add a new post to the top of the feed
   */
  function prependPost(post) {
    currentPosts.unshift(post);
    const feedContainer = document.getElementById('feedPosts');
    if (!feedContainer) return;

    // Check if empty state is shown
    const emptyState = feedContainer.querySelector('.empty-state');
    if (emptyState) {
      feedContainer.innerHTML = '';
    }

    const postHtml = renderPost(post, 0);
    feedContainer.insertAdjacentHTML('afterbegin', postHtml);
    Reactions.attachListeners();
  }

  /**
   * Delete a post from the feed
   */
  async function deletePost(postId) {
    const state = App.getState();
    const result = await App.apiRequest(`/api/posts/${postId}`, {
      method: 'DELETE',
      body: JSON.stringify({ drinker_id: state.drinkerId }),
    });

    if (!result.error) {
      // Remove from DOM
      const postEl = document.querySelector(`[data-post-id="${postId}"].feed-post`);
      if (postEl) {
        postEl.style.transition = 'all 0.3s ease';
        postEl.style.opacity = '0';
        postEl.style.transform = 'translateX(-100%)';
        setTimeout(() => postEl.remove(), 300);
      }
      currentPosts = currentPosts.filter(p => p.id !== postId);
      App.showToast('Post deleted. Like it never happened. 🫣', 'success');
    } else {
      App.showToast(result.data.error || 'Failed to delete post.', 'error');
    }
  }

  /**
   * Format time ago string
   */
  function formatTimeAgo(dateStr) {
    const now = new Date();
    const date = new Date(dateStr);
    const diffMs = now - date;
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHr = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHr / 24);

    if (diffSec < 60) return 'just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffHr < 24) return `${diffHr}h ago`;
    if (diffDay < 7) return `${diffDay}d ago`;
    return date.toLocaleDateString();
  }

  /**
   * Escape HTML to prevent XSS
   */
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // Handle delete button clicks via event delegation
  document.addEventListener('click', (e) => {
    const deleteBtn = e.target.closest('[data-action="delete"]');
    if (deleteBtn) {
      const postId = deleteBtn.dataset.postId;
      if (confirm('Delete this post? It\'ll disappear like your motivation on Monday.')) {
        deletePost(postId);
      }
    }
  });

  return {
    loadPosts,
    prependPost,
    deletePost,
    CATEGORY_INFO,
  };
})();
