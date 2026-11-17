/**
 * DrinkedIn - Admin Dashboard
 * Talks only to /api/admin/*. Credentials are never stored client-side.
 */

const Admin = (() => {
  const CATEGORY_INFO = {
    morning_after: { emoji: '🌅', label: 'Morning After' },
    office_rage: { emoji: '😤', label: 'Office Rage' },
    personal_overshare: { emoji: '🫣', label: 'Overshare' },
    industry_gossip: { emoji: '🍵', label: 'Gossip' },
    water_cooler: { emoji: '💧', label: 'Random' },
  };

  const REACTION_EMOJI = {
    cheers: '🍻',
    oof: '😬',
    tea: '🍵',
    same: '🤝',
    therapy: '🛋️',
    hr_risk: '🚨',
  };

  const ACTIVITY_META = {
    session_started: { icon: '🚪', label: 'Session started' },
    post_created: { icon: '📝', label: 'Post created' },
    reaction_added: { icon: '🍻', label: 'Reaction added' },
    post_deleted: { icon: '🗑️', label: 'Post deleted' },
    admin_post_deleted: { icon: '🛡️', label: 'Post deleted by admin' },
    admin_login: { icon: '🔐', label: 'Admin login' },
    admin_logout: { icon: '👋', label: 'Admin logout' },
  };

  const state = {
    authed: false,
    username: '',
    tab: 'overview',
    stats: null,
    users: [],
    activity: [],
    posts: [],
    userSearch: '',
    activityFilter: 'all',
    refreshTimer: null,
    toastTimer: null,
  };

  const $ = (id) => document.getElementById(id);

  function esc(value) {
    return String(value === null || value === undefined ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function num(value) {
    return Number(value || 0).toLocaleString();
  }

  function clampCount(value) {
    return Math.max(0, Number(value) || 0);
  }

  function displayName(record) {
    const name = record && record.drinker_name ? String(record.drinker_name) : '';
    return name || 'Anonymous Drinker';
  }

  function initial(name) {
    return String(name || '?').trim().charAt(0).toUpperCase() || '?';
  }

  function fmtDate(value) {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '—';
    return date.toLocaleString();
  }

  function timeAgo(value) {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '—';
    const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
    if (seconds < 60) return 'just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  }

  function categoryText(category) {
    const info = CATEGORY_INFO[category];
    return info ? `${info.emoji} ${info.label}` : (category || '—');
  }

  function toast(message, type = 'success') {
    const el = $('toast');
    if (!el) return;
    el.textContent = message;
    el.className = `toast ${type}`;
    el.classList.remove('hidden');

    clearTimeout(state.toastTimer);
    state.toastTimer = setTimeout(() => {
      el.classList.add('hidden');
    }, 4000);
  }

  function setLoginError(message) {
    const el = $('loginError');
    if (!el) return;
    if (message) {
      el.textContent = message;
      el.classList.remove('hidden');
    } else {
      el.textContent = '';
      el.classList.add('hidden');
    }
  }

  function setPasswordVisible(visible) {
    const input = $('loginPassword');
    const toggle = $('passwordToggle');
    if (!input || !toggle) return;
    input.type = visible ? 'text' : 'password';
    toggle.textContent = visible ? 'Hide' : 'Show';
    toggle.setAttribute('aria-label', visible ? 'Hide password' : 'Show password');
    toggle.setAttribute('aria-pressed', visible ? 'true' : 'false');
  }

  function togglePassword() {
    setPasswordVisible($('loginPassword').type === 'password');
  }

  async function api(path, options = {}) {
    const response = await fetch(path, {
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      ...options,
    });

    let data = {};
    try {
      data = await response.json();
    } catch {
      data = {};
    }

    if (response.status === 401) {
      showLogin();
      const error = new Error(data.error || 'Admin authentication required.');
      error.unauthorized = true;
      throw error;
    }

    if (!response.ok) {
      throw new Error(data.error || `Request failed (${response.status}).`);
    }

    return data;
  }

  function showLogin() {
    state.authed = false;
    $('adminShell').classList.add('hidden');
    $('loginScreen').classList.remove('hidden');
    setPasswordVisible(false);
    setLoginError('');
  }

  function enterDashboard(username) {
    state.authed = true;
    state.username = username || '';
    $('loginScreen').classList.add('hidden');
    $('adminShell').classList.remove('hidden');
    setPasswordVisible(false);
    loadAll();
  }

  async function boot() {
    bindEvents();

    try {
      const me = await api('/api/admin/me');
      enterDashboard(me.username);
    } catch (error) {
      if (!error.unauthorized) showLogin();
    }

    state.refreshTimer = setInterval(() => {
      if (state.authed && !document.hidden) loadAll(true);
    }, 30000);
  }

  function bindEvents() {
    $('loginForm').addEventListener('submit', onLogin);
    $('passwordToggle').addEventListener('click', togglePassword);
    $('logoutBtn').addEventListener('click', onLogout);
    $('refreshBtn').addEventListener('click', () => loadAll());
    $('syncBtn').addEventListener('click', onRebuild);

    $('tabs').addEventListener('click', (event) => {
      const tab = event.target.closest('.tab');
      if (!tab) return;
      state.tab = tab.dataset.tab;
      document.querySelectorAll('.tab').forEach((item) => {
        item.classList.toggle('active', item === tab);
      });
      document.querySelectorAll('.tab-panel').forEach((panel) => {
        panel.classList.toggle('active', panel.id === `panel-${state.tab}`);
      });
    });

    $('userSearch').addEventListener('input', (event) => {
      state.userSearch = event.target.value.trim().toLowerCase();
      renderUsers();
    });

    $('activityFilter').addEventListener('change', (event) => {
      state.activityFilter = event.target.value;
      renderActivity();
    });

    $('usersTable').addEventListener('click', (event) => {
      const row = event.target.closest('tr[data-user-key]');
      if (row) openUser(row.dataset.userKey);
    });

    $('topUsers').addEventListener('click', (event) => {
      const row = event.target.closest('[data-user-key]');
      if (row) openUser(row.dataset.userKey);
    });

    $('postsTable').addEventListener('click', (event) => {
      const button = event.target.closest('[data-delete-post]');
      if (!button) return;
      event.stopPropagation();
      deletePost(button.dataset.deletePost);
    });

    $('userModalClose').addEventListener('click', closeUserModal);
    $('userModal').addEventListener('click', (event) => {
      if (event.target === $('userModal')) closeUserModal();
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') closeUserModal();
    });
  }

  async function onLogin(event) {
    event.preventDefault();
    setLoginError('');

    const username = $('loginUsername').value.trim();
    const password = $('loginPassword').value;

    if (!username || !password) {
      setLoginError('Enter both username and password.');
      return;
    }

    const button = $('loginBtn');
    button.disabled = true;
    button.textContent = 'Signing in...';

    try {
      const data = await api('/api/admin/login', {
        method: 'POST',
        body: JSON.stringify({ username, password }),
      });
      $('loginPassword').value = '';
      setPasswordVisible(false);
      enterDashboard(data.username);
      toast(`Welcome back, ${data.username}.`, 'success');
    } catch (error) {
      setLoginError(error.message || 'Login failed.');
      if (error.unauthorized) {
        $('loginPassword').focus();
        $('loginPassword').select();
      }
    } finally {
      button.disabled = false;
      button.textContent = 'Sign In';
    }
  }

  async function onLogout() {
    try {
      await api('/api/admin/logout', { method: 'POST' });
    } catch {
      // Sign out locally even if the request failed.
    }
    state.authed = false;
    state.stats = null;
    state.users = [];
    state.activity = [];
    state.posts = [];
    setPasswordVisible(false);
    $('loginPassword').value = '';
    $('loginScreen').classList.remove('hidden');
    $('adminShell').classList.add('hidden');
    toast('Signed out.', 'success');
  }

  async function onRebuild() {
    if (!confirm('Rebuild user stats and counters from existing posts? This may take a moment.')) {
      return;
    }

    const button = $('syncBtn');
    button.disabled = true;
    button.textContent = 'Rebuilding...';

    try {
      const result = await api('/api/admin/sync', { method: 'POST' });
      toast(`Rebuilt ${num(result.users)} users from ${num(result.posts)} posts.`, 'success');
      await loadAll();
    } catch (error) {
      toast(error.message || 'Rebuild failed.', 'error');
    } finally {
      button.disabled = false;
      button.textContent = 'Rebuild';
    }
  }

  async function loadAll(silent = false) {
    if (!state.authed) return;

    try {
      const [stats, users, activity, posts] = await Promise.all([
        api('/api/admin/stats'),
        api('/api/admin/users'),
        api('/api/admin/activity'),
        api('/api/admin/posts'),
      ]);

      state.stats = stats;
      state.users = users.items || [];
      state.activity = activity.items || [];
      state.posts = posts.items || [];

      renderStats();
      renderUsers();
      renderActivity();
      renderPosts();

      $('lastRefreshed').textContent = `Updated ${new Date().toLocaleTimeString()}`;
    } catch (error) {
      if (error.unauthorized) {
        showLogin();
        return;
      }
      if (!silent) toast(error.message || 'Failed to load dashboard data.', 'error');
    }
  }

  function renderStats() {
    const stats = state.stats;
    if (!stats || !stats.totals) return;

    const totals = stats.totals;
    $('statUsers').textContent = num(totals.users);
    $('statPosts').textContent = num(totals.posts);
    $('statReactions').textContent = num(totals.reactions);
    $('statActiveToday').textContent = num(totals.activeToday);
    $('statPostsToday').textContent = num(totals.postsToday);
    $('statActivityToday').textContent = num(totals.activityToday);
    $('lastActivity').textContent = stats.lastActivityAt
      ? `Last event ${timeAgo(stats.lastActivityAt)}`
      : '—';

    const categories = Object.entries(stats.categories || {}).sort((a, b) => b[1] - a[1]);
    const max = Math.max(1, ...categories.map(([, count]) => count));
    const categoryContainer = $('categoryBreakdown');

    if (categories.length === 0) {
      categoryContainer.innerHTML = '<div class="empty-inline">No posts yet.</div>';
    } else {
      categoryContainer.innerHTML = categories.map(([key, count]) => {
        const info = CATEGORY_INFO[key];
        const label = info ? `${info.emoji} ${info.label}` : key;
        const width = Math.max(3, Math.round((count / max) * 100));
        return `
          <div class="category-row">
            <div class="category-name">${esc(label)}</div>
            <div class="category-bar"><div class="category-fill" style="width:${width}%"></div></div>
            <div class="category-count">${num(count)}</div>
          </div>
        `;
      }).join('');
    }

    renderTopUsers(stats.topUsers || []);
    $('overviewActivity').innerHTML = (stats.recentActivity || []).length
      ? stats.recentActivity.map(activityItemHtml).join('')
      : '<div class="empty-inline">No activity recorded yet.</div>';
  }

  function renderTopUsers(users) {
    const container = $('topUsers');

    if (!users.length) {
      container.innerHTML = '<div class="empty-inline">No users yet.</div>';
      return;
    }

    container.innerHTML = users.map((user, index) => {
      const name = displayName(user);
      const posts = clampCount(user.posts_count);
      return `
        <div class="top-user" data-user-key="${esc(user.id)}">
          <div class="top-user-rank">#${index + 1}</div>
          <div class="top-user-avatar">${esc(initial(name))}</div>
          <div class="top-user-main">
            <div class="top-user-name">${esc(name)}</div>
            <div class="top-user-meta">Last seen ${esc(timeAgo(user.last_seen))}</div>
          </div>
          <div class="top-user-count">${num(posts)}</div>
        </div>
      `;
    }).join('');
  }

  function renderUsers() {
    const tbody = $('usersTable');
    const query = state.userSearch;
    const users = state.users.filter((user) => {
      if (!query) return true;
      return [user.drinker_name, user.drinker_id, user.last_ip]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query));
    });

    $('userCount').textContent = `${num(users.length)} user${users.length === 1 ? '' : 's'}`;

    if (users.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" class="empty-cell">No users match.</td></tr>';
      return;
    }

    tbody.innerHTML = users.map((user) => {
      const name = displayName(user);
      return `
        <tr class="clickable" data-user-key="${esc(user.id)}">
          <td>
            <div class="table-user">
              <div class="table-avatar">${esc(initial(name))}</div>
              <div>
                <div class="table-user-name">${esc(name)}</div>
                <div class="table-user-id" title="${esc(user.drinker_id || '')}">${esc(user.drinker_id || '—')}</div>
              </div>
            </div>
          </td>
          <td class="num">${num(clampCount(user.posts_count))}</td>
          <td class="num">${num(clampCount(user.reactions_given))}</td>
          <td class="num">${num(clampCount(user.sessions))}</td>
          <td title="${esc(fmtDate(user.last_seen))}">${esc(timeAgo(user.last_seen))}</td>
          <td>${esc(user.last_ip || '—')}</td>
        </tr>
      `;
    }).join('');
  }

  function renderActivity() {
    const container = $('activityList');
    const filter = state.activityFilter;
    const items = state.activity.filter((item) => filter === 'all' || item.type === filter);

    $('activityCount').textContent = `${num(items.length)} event${items.length === 1 ? '' : 's'}`;

    container.innerHTML = items.length
      ? items.map(activityItemHtml).join('')
      : '<div class="empty-inline">No activity recorded yet.</div>';
  }

  function activityItemHtml(item) {
    const meta = ACTIVITY_META[item.type] || { icon: '•', label: item.type || 'Event' };
    const name = displayName(item);
    const category = CATEGORY_INFO[item.category];
    let title;

    switch (item.type) {
      case 'session_started':
        title = `<strong>${esc(name)}</strong> started a session`;
        break;
      case 'post_created':
        title = `<strong>${esc(name)}</strong> posted${category ? ` in ${esc(category.label)}` : ''}`;
        break;
      case 'reaction_added':
        title = `<strong>${esc(name)}</strong> reacted ${REACTION_EMOJI[item.reaction] || ''} ${esc(item.reaction || '')}`;
        break;
      case 'post_deleted':
        title = `<strong>${esc(name)}</strong> deleted a post`;
        break;
      case 'admin_post_deleted':
        title = `Admin deleted a post by <strong>${esc(name)}</strong>`;
        break;
      case 'admin_login':
        title = `Admin <strong>${esc(item.drinker_name || 'unknown')}</strong> logged in`;
        break;
      case 'admin_logout':
        title = `Admin <strong>${esc(item.drinker_name || 'unknown')}</strong> logged out`;
        break;
      default:
        title = esc(meta.label);
    }

    const preview = item.content_preview
      ? `<div class="activity-text">${esc(item.content_preview)}</div>`
      : '';

    const metaBits = [
      `<span>${esc(timeAgo(item.created_at || item.created))}</span>`,
      item.ip ? `<span>IP ${esc(item.ip)}</span>` : '',
      category ? `<span>${esc(category.emoji)} ${esc(category.label)}</span>` : '',
      item.is_anonymous ? '<span class="badge anon">Anonymous</span>' : '',
    ].filter(Boolean).join('');

    return `
      <div class="activity-item">
        <div class="activity-icon">${meta.icon}</div>
        <div class="activity-main">
          <div class="activity-title">${title}</div>
          ${preview}
          <div class="activity-meta">${metaBits}</div>
        </div>
      </div>
    `;
  }

  function renderPosts() {
    const tbody = $('postsTable');
    $('postCount').textContent = `${num(state.posts.length)} post${state.posts.length === 1 ? '' : 's'}`;

    if (state.posts.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" class="empty-cell">No posts yet.</td></tr>';
      return;
    }

    tbody.innerHTML = state.posts.map((post) => {
      const name = displayName(post);
      return `
        <tr>
          <td class="post-cell">
            <div class="post-content-preview">${esc(post.content || '')}</div>
            <div class="post-sub">#${esc(post.id)}</div>
          </td>
          <td>
            <div class="table-user">
              <div class="table-avatar">${esc(initial(name))}</div>
              <div>
                <div class="table-user-name">${esc(name)}</div>
                <div class="table-user-id" title="${esc(post.drinker_id || '')}">${esc(post.drinker_id || '—')}</div>
              </div>
            </div>
          </td>
          <td>${esc(categoryText(post.category))}</td>
          <td class="num">${num(post.reactionTotal)}</td>
          <td title="${esc(fmtDate(post.created_at))}">${esc(timeAgo(post.created_at))}</td>
          <td><button type="button" class="btn btn-danger btn-sm" data-delete-post="${esc(post.id)}">Delete</button></td>
        </tr>
      `;
    }).join('');
  }

  async function openUser(key) {
    const modal = $('userModal');
    const body = $('userModalBody');

    $('userModalTitle').textContent = 'Loading...';
    body.innerHTML = '<div class="empty-inline">Loading user details...</div>';
    modal.classList.remove('hidden');

    try {
      const data = await api(`/api/admin/users/${encodeURIComponent(key)}`);
      renderUserDetail(data);
    } catch (error) {
      if (error.unauthorized) return;
      $('userModalTitle').textContent = 'User';
      body.innerHTML = `<div class="empty-inline">${esc(error.message || 'Failed to load user.')}</div>`;
    }
  }

  function closeUserModal() {
    $('userModal').classList.add('hidden');
  }

  function renderUserDetail(data) {
    const user = data.user || {};
    const posts = data.posts || [];
    const activity = data.activity || [];
    const name = displayName(user);

    $('userModalTitle').textContent = name;

    const details = [
      ['Drinker', esc(name)],
      ['Drinker ID', `<span class="detail-value small">${esc(user.drinker_id || '—')}</span>`],
      ['Posts', num(clampCount(user.posts_count))],
      ['Reactions Given', num(clampCount(user.reactions_given))],
      ['Sessions', num(clampCount(user.sessions))],
      ['Deleted Posts', num(clampCount(user.posts_deleted))],
      ['Anonymous Posts', num(clampCount(user.anonymous_posts))],
      ['First Seen', `<span class="detail-value small">${esc(fmtDate(user.first_seen))}</span>`],
      ['Last Seen', `<span class="detail-value small">${esc(fmtDate(user.last_seen))}</span>`],
      ['Last IP', esc(user.last_ip || '—')],
      ['Last Category', esc(categoryText(user.last_category))],
      ['Company Type', esc(user.last_company_type || '—')],
    ];

    const detailsHtml = details.map(([label, value]) => `
      <div class="detail-box">
        <div class="detail-label">${esc(label)}</div>
        <div class="detail-value">${value}</div>
      </div>
    `).join('');

    const postsHtml = posts.length
      ? posts.map((post) => `
          <div class="mini-post">
            <div class="mini-post-head">
              <span>${esc(categoryText(post.category))}</span>
              <span>${esc(fmtDate(post.created_at || post.created))}</span>
            </div>
            <div class="mini-post-body">${esc(post.content || '')}</div>
          </div>
        `).join('')
      : '<div class="empty-inline">No posts from this drinker.</div>';

    const activityHtml = activity.length
      ? activity.map(activityItemHtml).join('')
      : '<div class="empty-inline">No activity recorded for this drinker.</div>';

    $('userModalBody').innerHTML = `
      <div class="modal-section">
        <h3>Profile</h3>
        <div class="detail-grid">${detailsHtml}</div>
      </div>
      <div class="modal-section">
        <h3>Recent Posts</h3>
        ${postsHtml}
      </div>
      <div class="modal-section">
        <h3>Recent Activity</h3>
        <div class="activity-list">${activityHtml}</div>
      </div>
      <div class="modal-section">
        <h3>Client</h3>
        <div class="detail-box">
          <div class="detail-label">Last User-Agent</div>
          <div class="detail-value small">${esc(user.last_user_agent || '—')}</div>
        </div>
      </div>
    `;
  }

  async function deletePost(id) {
    if (!confirm('Delete this post permanently? This cannot be undone.')) return;

    try {
      await api(`/api/admin/posts/${encodeURIComponent(id)}`, { method: 'DELETE' });
      toast('Post deleted.', 'success');
      await loadAll();
    } catch (error) {
      if (!error.unauthorized) toast(error.message || 'Failed to delete post.', 'error');
    }
  }

  document.addEventListener('DOMContentLoaded', boot);

  return {
    loadAll,
  };
})();
