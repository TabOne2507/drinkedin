/**
 * DrinkedIn - Main Application Controller
 * Manages session, routing, and global state
 */

const App = (() => {
  // Session state (sessionStorage only, never sent to DB)
  let state = {
    drinkerId: null,
    drinkerName: null,
    isAuthenticated: false,
    currentCategory: 'all',
    currentPage: 1,
    postsPerPage: 20,
    sessionRantCount: 0,
    sessionCheersReceived: 0,
  };

  /**
   * Initialize the application
   */
  function init() {
    // Check if user already has a session
    const savedId = sessionStorage.getItem('drinkedin_id');
    const savedName = sessionStorage.getItem('drinkedin_name');

    if (savedId && savedName) {
      state.drinkerId = savedId;
      state.drinkerName = savedName;
      state.isAuthenticated = true;
      onAuthenticated();
    } else {
      // Show drinker dialog
      DrinkerDialog.show();
    }

    // Set up global event listeners
    setupEventListeners();
  }

  /**
   * Called when user enters their drinker name
   */
  function onAuthenticated() {
    state.isAuthenticated = true;
    updateUIWithUser();
    Feed.loadPosts('all', 1);
    Sidebar.init();
  }

  /**
   * Set session data after drinker name entry
   */
  function setSession(drinkerName, drinkerId) {
    state.drinkerName = drinkerName;
    state.drinkerId = drinkerId;
    state.isAuthenticated = true;
    sessionStorage.setItem('drinkedin_id', drinkerId);
    sessionStorage.setItem('drinkedin_name', drinkerName);
    onAuthenticated();
  }

  /**
   * Update UI elements with user info
   */
  function updateUIWithUser() {
    const initial = state.drinkerName ? state.drinkerName[0].toUpperCase() : '?';

    // Nav avatar
    const navAvatar = document.getElementById('navAvatar');
    if (navAvatar) navAvatar.textContent = initial;

    const navProfileName = document.getElementById('navProfileName');
    if (navProfileName) navProfileName.textContent = state.drinkerName;

    // Profile card
    const profileAvatar = document.getElementById('profileAvatar');
    if (profileAvatar) profileAvatar.textContent = initial;

    const profileName = document.getElementById('profileName');
    if (profileName) profileName.textContent = state.drinkerName;

    // Composer avatar
    const composerAvatar = document.getElementById('composerAvatar');
    if (composerAvatar) composerAvatar.textContent = initial;

    // Compose modal
    const composeModalAvatar = document.getElementById('composeModalAvatar');
    if (composeModalAvatar) composeModalAvatar.textContent = initial;

    const composeModalName = document.getElementById('composeModalName');
    if (composeModalName) composeModalName.textContent = state.drinkerName;
  }

  /**
   * Set up global event listeners
   */
  function setupEventListeners() {
    // Nav link clicks
    const navLinks = document.getElementById('navLinks');
    if (navLinks) {
      navLinks.addEventListener('click', (e) => {
        const link = e.target.closest('.nav-link');
        if (link) {
          e.preventDefault();
          document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
          link.classList.add('active');
          const page = link.dataset.page;
          handleNavigation(page);
        }
      });
    }

    // Category tab clicks
    const categoryTabs = document.getElementById('categoryTabs');
    if (categoryTabs) {
      categoryTabs.addEventListener('click', (e) => {
        const tab = e.target.closest('.category-tab');
        if (tab) {
          document.querySelectorAll('.category-tab').forEach(t => t.classList.remove('active'));
          tab.classList.add('active');
          const category = tab.dataset.category;
          setCategory(category);
        }
      });
    }

    // Sidebar nav clicks
    document.querySelectorAll('.sidebar-nav-item').forEach(item => {
      item.addEventListener('click', () => {
        document.querySelectorAll('.sidebar-nav-item').forEach(i => i.classList.remove('active'));
        item.classList.add('active');
        const category = item.dataset.category;
        setCategory(category);

        // Sync category tabs
        document.querySelectorAll('.category-tab').forEach(t => {
          t.classList.toggle('active', t.dataset.category === category);
        });
      });
    });

    // Load more button
    const loadMoreBtn = document.getElementById('loadMoreBtn');
    if (loadMoreBtn) {
      loadMoreBtn.addEventListener('click', () => {
        state.currentPage++;
        Feed.loadPosts(state.currentCategory, state.currentPage, true);
      });
    }

    // Logo click → reload
    const navLogo = document.getElementById('navLogo');
    if (navLogo) {
      navLogo.addEventListener('click', (e) => {
        e.preventDefault();
        setCategory('all');
        document.querySelectorAll('.category-tab').forEach(t => {
          t.classList.toggle('active', t.dataset.category === 'all');
        });
        document.querySelectorAll('.sidebar-nav-item').forEach(i => {
          i.classList.toggle('active', i.dataset.category === 'all');
        });
      });
    }
  }

  /**
   * Handle nav page navigation
   */
  function handleNavigation(page) {
    // For now, only home shows the feed
    // Other pages could show coming soon
    if (page === 'home') {
      setCategory('all');
    } else if (page === 'antijobs') {
      showToast('🚫 There are no jobs here. That\'s the whole point.', 'warning');
    } else if (page === 'dms') {
      showToast('💬 DMs coming soon. Gossip protocols loading...', 'warning');
    } else if (page === 'alerts') {
      showToast('🔔 Drama alerts coming soon. Stay messy.', 'warning');
    } else if (page === 'mybar') {
      showToast('🍺 My Bar coming soon. Keep drinking.', 'warning');
    }
  }

  /**
   * Set current category and reload feed
   */
  function setCategory(category) {
    state.currentCategory = category;
    state.currentPage = 1;
    Feed.loadPosts(category, 1);
  }

  /**
   * Increment session rant count
   */
  function incrementRantCount() {
    state.sessionRantCount++;
    const statRants = document.getElementById('statRants');
    if (statRants) statRants.textContent = state.sessionRantCount;
    Sidebar.updateRageMeter(state.sessionRantCount);
  }

  /**
   * Get current state
   */
  function getState() {
    return { ...state };
  }

  /**
   * Show toast notification
   */
  function showToast(message, type = 'success') {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    container.appendChild(toast);

    setTimeout(() => {
      if (toast.parentNode) {
        toast.remove();
      }
    }, 4000);
  }

  /**
   * Show corporate firewall warning
   */
  function showFirewallWarning(message, suggestion) {
    const warning = document.getElementById('firewallWarning');
    const msgEl = document.getElementById('firewallMessage');
    const sugEl = document.getElementById('firewallSuggestion');

    if (msgEl) msgEl.textContent = message;
    if (sugEl) sugEl.textContent = suggestion || '';

    if (warning) {
      warning.classList.add('visible');
      setTimeout(() => {
        warning.classList.remove('visible');
      }, 6000);
    }
  }

  // Firewall warning close button
  document.addEventListener('DOMContentLoaded', () => {
    const closeBtn = document.getElementById('firewallWarningClose');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        document.getElementById('firewallWarning').classList.remove('visible');
      });
    }
  });

  // API helper
  async function apiRequest(url, options = {}) {
    try {
      const response = await fetch(url, {
        headers: { 'Content-Type': 'application/json' },
        ...options,
      });
      const data = await response.json();

      if (!response.ok) {
        // Check for corporate firewall block
        if (response.status === 422 && data.blocked) {
          showFirewallWarning(data.message, data.suggestion);
          return { error: true, blocked: true, data };
        }
        return { error: true, data };
      }

      return { error: false, data };
    } catch (err) {
      console.error('API Error:', err);
      return { error: true, data: { error: 'Network error. Server might be passed out. 🍺' } };
    }
  }

  return {
    init,
    setSession,
    getState,
    incrementRantCount,
    showToast,
    showFirewallWarning,
    apiRequest,
    setCategory,
  };
})();

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  App.init();
});
