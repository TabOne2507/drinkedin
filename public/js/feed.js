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

  /**
   * Load posts from API
   */
  async function loadPosts(category = 'all', page = 1, append = false) {
    const feedContainer = document.getElementById('feedPosts');
    const loadMoreBtn = document.getElementById('loadMoreBtn');

    if (!feedContainer) return;

    // Show loading skeleton if first page
    if (!append) {
      feedContainer.innerHTML = renderSkeletons(3);
    }

    const result = await App.apiRequest(`/api/posts?category=${category}&page=${page}&perPage=20`);

    if (result.error) {
      if (append) {
        App.showToast(result.data.error || 'Could not load more posts.', 'error');
        return;
      }
      feedContainer.innerHTML = renderErrorState(result.data.error);
      if (loadMoreBtn) loadMoreBtn.classList.add('hidden');
      const retryBtn = document.getElementById('retryFeedBtn');
      if (retryBtn) retryBtn.addEventListener('click', () => loadPosts(category, 1));
      return;
    }

    const posts = result.data.items;
    hasMorePages = page < result.data.totalPages;

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
   * Render a feed loading error with a retry button
   */
  function renderErrorState(message) {
    return `
      <div class="empty-state">
        <div class="empty-state-icon">🚫</div>
        <div class="empty-state-title">Couldn't load the feed</div>
        <div class="empty-state-text">
          ${escapeHtml(message || 'The server is passed out. Try again in a moment.')}
        </div>
        <button class="load-more-btn" id="retryFeedBtn" type="button">Try again ↻</button>
      </div>
    `;
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
