/**
 * DrinkedIn - Reactions Module
 * Handles reaction clicks, animations, and API calls
 */

const Reactions = (() => {
  // Track which reactions user has made (per session to avoid double-reacting)
  const reactedPosts = new Map(); // postId -> Set of reaction types

  const REACTION_EMOJIS = {
    cheers: '🍻',
    oof: '😬',
    tea: '🍵',
    same: '🤝',
    therapy: '🛋️',
    hr_risk: '🚨',
  };

  /**
   * Attach click listeners to all reaction buttons in the feed
   */
  function attachListeners() {
    const feed = document.getElementById('feedPosts');
    if (!feed) return;

    // Use event delegation on the feed container
    feed.removeEventListener('click', handleReactionClick);
    feed.addEventListener('click', handleReactionClick);
  }

  /**
   * Handle reaction button click via event delegation
   */
  async function handleReactionClick(e) {
    const btn = e.target.closest('.post-action-btn');
    if (!btn) return;

    const reaction = btn.dataset.reaction;
    if (!reaction) return;

    const postActions = btn.closest('.post-actions');
    if (!postActions) return;

    const postId = postActions.dataset.postId;
    if (!postId) return;

    // Check if already reacted with this type
    if (reactedPosts.has(postId)) {
      const reactions = reactedPosts.get(postId);
      if (reactions.has(reaction)) {
        App.showToast('You already reacted with that. Save some emotion for tomorrow. 😅', 'warning');
        return;
      }
    }

    // Animate the button
    const icon = btn.querySelector('.reaction-icon');
    if (icon) {
      icon.classList.add('reaction-pop');
      setTimeout(() => icon.classList.remove('reaction-pop'), 300);
    }

    // Mark as reacted visually
    btn.classList.add('reacted');

    // Track reaction locally
    if (!reactedPosts.has(postId)) {
      reactedPosts.set(postId, new Set());
    }
    reactedPosts.get(postId).add(reaction);

    // Optimistically update count
    const countEl = btn.querySelector('.reaction-count');
    if (countEl) {
      const current = parseInt(countEl.textContent) || 0;
      countEl.textContent = current + 1;
    }

    // Update cheers stat if it's a cheers reaction
    if (reaction === 'cheers') {
      const state = App.getState();
      const statCheers = document.getElementById('statCheers');
      if (statCheers) {
        statCheers.textContent = parseInt(statCheers.textContent || 0) + 1;
      }
    }

    // Send to API
    const result = await App.apiRequest(`/api/posts/${postId}/react`, {
      method: 'POST',
      body: JSON.stringify({ reaction }),
    });

    if (result.error) {
      // Revert on failure (but don't bother the user for sample posts)
      if (!postId.startsWith('sample-') && !postId.startsWith('local-')) {
        // Revert optimistic update
        if (countEl) {
          const current = parseInt(countEl.textContent) || 0;
          countEl.textContent = Math.max(0, current - 1) || '';
        }
        btn.classList.remove('reacted');
        reactedPosts.get(postId)?.delete(reaction);
      }
    } else if (result.data.reactions) {
      // Update all reaction counts from server response
      updateReactionCounts(postId, result.data.reactions);
    }
  }

  /**
   * Update all reaction counts for a post from server data
   */
  function updateReactionCounts(postId, reactions) {
    const postActions = document.querySelector(`.post-actions[data-post-id="${postId}"]`);
    if (!postActions) return;

    Object.entries(reactions).forEach(([type, count]) => {
      const btn = postActions.querySelector(`[data-reaction="${type}"]`);
      if (btn) {
        const countEl = btn.querySelector('.reaction-count');
        if (countEl) {
          countEl.textContent = count || '';
        }
      }
    });

    // Update reaction summary
    const post = postActions.closest('.feed-post');
    if (post) {
      const totalReactions = Object.values(reactions).reduce((a, b) => a + b, 0);
      let summary = post.querySelector('.post-reactions-summary');

      if (totalReactions > 0) {
        const topEmojis = Object.entries(reactions)
          .filter(([, count]) => count > 0)
          .sort(([, a], [, b]) => b - a)
          .slice(0, 3)
          .map(([key]) => `<span>${REACTION_EMOJIS[key]}</span>`)
          .join('');

        if (summary) {
          summary.innerHTML = `
            <div class="reaction-emoji-stack">${topEmojis}</div>
            <span>${totalReactions} reactions</span>
          `;
        } else {
          // Create summary element before post-actions
          const summaryHtml = `
            <div class="post-reactions-summary">
              <div class="reaction-emoji-stack">${topEmojis}</div>
              <span>${totalReactions} reactions</span>
            </div>
          `;
          postActions.insertAdjacentHTML('beforebegin', summaryHtml);
        }
      }
    }
  }

  return {
    attachListeners,
  };
})();
