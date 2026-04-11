/**
 * DrinkedIn - Post Composer Module
 * Handles post creation modal, category selection, anonymous toggle,
 * and Corporate Firewall™ client-side pre-check
 */

const PostComposer = (() => {
  let selectedCategory = 'water_cooler';
  let isAnonymous = false;

  // Corporate buzzword quick check (client-side pre-filter)
  const CORPORATE_KEYWORDS = [
    'now hiring', 'we\'re hiring', 'join our team', 'career opportunity',
    'apply now', 'job opening', 'job posting', 'open position', 'open role',
    'hiring for', 'recruiting for', 'talent acquisition', 'send your resume',
    'job description', 'compensation package', 'referral bonus',
    'excited to announce', 'thrilled to share', 'new role', 'new chapter',
    'professional journey', 'thought leadership', 'synergy', 'paradigm shift',
    'circle back', 'low-hanging fruit', 'move the needle', 'value proposition',
  ];

  // Auto-templates for categories
  const TEMPLATES = {
    morning_after: [
      "Tonight's poison: ",
      "Hangover rating: /10. Corporate pain correlation: ",
      "Woke up and immediately regretted ",
    ],
    office_rage: [
      "My boss just... ",
      "I can't believe my coworker ",
      "Who else hates when ",
      "Day #? of pretending to care about ",
    ],
    personal_overshare: [
      "So my date last night ",
      "Can't believe I just ",
      "Anyone else feel like ",
    ],
    industry_gossip: [
      "CONFIRMED: ",
      "Okay so I heard from a friend of a friend that ",
      "Hot take: ",
    ],
    water_cooler: [
      "Shower thought: ",
      "Controversial opinion but ",
      "Why does no one talk about ",
    ],
  };

  function init() {
    setupListeners();
  }

  function setupListeners() {
    // Open compose modal
    const composerBtn = document.getElementById('composerInputBtn');
    if (composerBtn) {
      composerBtn.addEventListener('click', openModal);
    }

    // Composer action buttons (open with pre-selected category)
    document.querySelectorAll('.composer-action').forEach(btn => {
      btn.addEventListener('click', () => {
        const category = btn.dataset.category;
        openModal(null, category);
      });
    });

    // Close modal
    const closeBtn = document.getElementById('composeModalClose');
    if (closeBtn) {
      closeBtn.addEventListener('click', closeModal);
    }

    // Close on overlay click
    const overlay = document.getElementById('composeModalOverlay');
    if (overlay) {
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) closeModal();
      });
    }

    // Category selection in modal
    document.querySelectorAll('.compose-category-option').forEach(option => {
      option.addEventListener('click', () => {
        document.querySelectorAll('.compose-category-option').forEach(o => o.classList.remove('selected'));
        option.classList.add('selected');
        selectedCategory = option.dataset.category;
      });
    });

    // Anonymous toggle
    const anonToggle = document.getElementById('anonToggle');
    const anonSwitch = document.getElementById('anonSwitch');
    if (anonToggle && anonSwitch) {
      anonToggle.addEventListener('click', () => {
        isAnonymous = !isAnonymous;
        anonSwitch.classList.toggle('active', isAnonymous);

        // Show/hide company type selector
        const wrapper = document.getElementById('companyTypeWrapper');
        if (wrapper) {
          wrapper.classList.toggle('hidden', !isAnonymous);
        }

        // Update avatar in modal
        const avatar = document.getElementById('composeModalAvatar');
        const nameEl = document.getElementById('composeModalName');
        if (isAnonymous) {
          if (avatar) avatar.textContent = '🕶️';
          if (nameEl) nameEl.textContent = 'Anonymous Drinker';
        } else {
          const state = App.getState();
          if (avatar) avatar.textContent = (state.drinkerName || '?')[0].toUpperCase();
          if (nameEl) nameEl.textContent = state.drinkerName || 'Drinker';
        }
      });
    }

    // Textarea input (char counter + corporate precheck)
    const textarea = document.getElementById('composeTextarea');
    if (textarea) {
      textarea.addEventListener('input', onTextInput);
    }

    // Submit post
    const submitBtn = document.getElementById('submitPostBtn');
    if (submitBtn) {
      submitBtn.addEventListener('click', submitPost);
    }

    // Keyboard shortcut: Escape to close
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        closeModal();
      }
    });
  }

  function openModal(e, preCategory) {
    const overlay = document.getElementById('composeModalOverlay');
    if (overlay) {
      overlay.classList.add('active');
    }

    // Pre-select category if provided
    if (preCategory) {
      selectedCategory = preCategory;
      document.querySelectorAll('.compose-category-option').forEach(o => {
        o.classList.toggle('selected', o.dataset.category === preCategory);
      });
    }

    // Focus textarea
    const textarea = document.getElementById('composeTextarea');
    if (textarea) {
      setTimeout(() => textarea.focus(), 200);

      // Set template placeholder based on selected category
      const templates = TEMPLATES[selectedCategory] || TEMPLATES.water_cooler;
      const randomTemplate = templates[Math.floor(Math.random() * templates.length)];
      textarea.placeholder = randomTemplate;
    }

    // Reset anonymous state
    isAnonymous = false;
    const anonSwitch = document.getElementById('anonSwitch');
    if (anonSwitch) anonSwitch.classList.remove('active');
    const wrapper = document.getElementById('companyTypeWrapper');
    if (wrapper) wrapper.classList.add('hidden');
  }

  function closeModal() {
    const overlay = document.getElementById('composeModalOverlay');
    if (overlay) {
      overlay.classList.remove('active');
    }
  }

  function onTextInput(e) {
    const content = e.target.value;
    const length = content.length;

    // Update char counter
    const counter = document.getElementById('charCounter');
    if (counter) {
      counter.textContent = `${length} / 3000`;
      counter.className = 'char-counter';
      if (length > 2700) counter.className = 'char-counter danger';
      else if (length > 2000) counter.className = 'char-counter warning';
    }

    // Enable/disable submit button
    const submitBtn = document.getElementById('submitPostBtn');
    if (submitBtn) {
      submitBtn.disabled = length < 3;
    }
  }

  /**
   * Client-side Corporate Firewall™ pre-check
   */
  function corporatePreCheck(content) {
    const lower = content.toLowerCase();
    for (const keyword of CORPORATE_KEYWORDS) {
      if (lower.includes(keyword)) {
        return {
          blocked: true,
          keyword: keyword,
          message: `Detected corporate content: "${keyword}". This is DrinkedIn, not LinkedIn!`,
        };
      }
    }
    return { blocked: false };
  }

  /**
   * Submit a new post
   */
  async function submitPost() {
    const textarea = document.getElementById('composeTextarea');
    const submitBtn = document.getElementById('submitPostBtn');
    if (!textarea || !submitBtn) return;

    const content = textarea.value.trim();
    if (content.length < 3) return;

    // Client-side pre-check
    const preCheck = corporatePreCheck(content);
    if (preCheck.blocked) {
      App.showFirewallWarning(preCheck.message, 'Rephrase it like you\'re texting your friends, not updating your LinkedIn.');
      return;
    }

    // Disable button during submission
    submitBtn.disabled = true;
    submitBtn.textContent = 'Posting... 🍺';

    const state = App.getState();
    const companyType = isAnonymous ? (document.getElementById('companyTypeSelect')?.value || '') : '';

    const postData = {
      drinker_id: state.drinkerId,
      drinker_name: state.drinkerName,
      content: content,
      category: selectedCategory,
      is_anonymous: isAnonymous,
      company_type: companyType,
    };

    const result = await App.apiRequest('/api/posts', {
      method: 'POST',
      body: JSON.stringify(postData),
    });

    if (result.error) {
      if (result.blocked) {
        // Corporate Firewall blocked it server-side
        submitBtn.disabled = false;
        submitBtn.textContent = 'Post 🍺';
        return;
      }

      // If PocketBase is unavailable, create the post locally for demo
      if (result.data.error && result.data.error.includes('Network')) {
        const fakePost = {
          id: 'local-' + Date.now(),
          ...postData,
          drinker_name: isAnonymous ? 'Anonymous Drinker' : state.drinkerName,
          reactions: { cheers: 0, oof: 0, tea: 0, same: 0, therapy: 0, hr_risk: 0 },
          created: new Date().toISOString(),
        };
        Feed.prependPost(fakePost);
        App.incrementRantCount();
        App.showToast('Posted! (offline mode — will sync when server wakes up) 🍺', 'success');
        resetForm();
        closeModal();
        return;
      }

      App.showToast(result.data.error || 'Failed to post. Try screaming instead.', 'error');
      submitBtn.disabled = false;
      submitBtn.textContent = 'Post 🍺';
      return;
    }

    // Success!
    if (result.data.warning) {
      App.showToast(`⚠️ ${result.data.warning.message}`, 'warning');
    }

    Feed.prependPost(result.data.post);
    App.incrementRantCount();
    App.showToast('Posted! Let the chaos begin. 🍺', 'success');
    resetForm();
    closeModal();
  }

  function resetForm() {
    const textarea = document.getElementById('composeTextarea');
    const counter = document.getElementById('charCounter');
    const submitBtn = document.getElementById('submitPostBtn');

    if (textarea) textarea.value = '';
    if (counter) {
      counter.textContent = '0 / 3000';
      counter.className = 'char-counter';
    }
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Post 🍺';
    }
  }

  // Auto-init when DOM loaded
  document.addEventListener('DOMContentLoaded', () => {
    init();
  });

  return {
    openModal,
    closeModal,
  };
})();
