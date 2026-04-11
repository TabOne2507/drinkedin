/**
 * DrinkedIn - Drinker Name Dialog
 * Entry gate where users provide their drinker name
 * Validates: 8-16 chars, letters, numbers, 2+ special characters
 * Generates unique ID: DrinkerName_HHMMSS_DDMMYYYY
 */

const DrinkerDialog = (() => {
  let isValid = false;

  const SPECIAL_CHARS = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`]/g;
  const ALLOWED_SPECIAL = '!@#$%&*_';

  function show() {
    const overlay = document.getElementById('drinkerDialogOverlay');
    if (overlay) {
      overlay.style.display = 'flex';
      overlay.classList.remove('closing');
    }
    setupListeners();
  }

  function hide() {
    const overlay = document.getElementById('drinkerDialogOverlay');
    if (overlay) {
      overlay.classList.add('closing');
      setTimeout(() => {
        overlay.style.display = 'none';
      }, 500);
    }
  }

  function setupListeners() {
    const input = document.getElementById('drinkerNameInput');
    const enterBtn = document.getElementById('drinkerEnterBtn');

    if (input) {
      input.addEventListener('input', onInputChange);
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && isValid) {
          onEnter();
        }
      });
      // Auto-focus
      setTimeout(() => input.focus(), 300);
    }

    if (enterBtn) {
      enterBtn.addEventListener('click', onEnter);
    }
  }

  function onInputChange(e) {
    const value = e.target.value;
    const input = e.target;
    validateAndUpdate(value, input);
  }

  function validateAndUpdate(value, inputEl) {
    const rules = {
      length: value.length >= 8 && value.length <= 16,
      alpha: /[a-zA-Z]/.test(value),
      number: /[0-9]/.test(value),
      special: (value.match(SPECIAL_CHARS) || []).length >= 2,
    };

    // Update rule indicators
    updateRule('rule-length', rules.length);
    updateRule('rule-alpha', rules.alpha);
    updateRule('rule-number', rules.number);
    updateRule('rule-special', rules.special);

    // Overall validity
    isValid = rules.length && rules.alpha && rules.number && rules.special;

    // Update input styling
    if (value.length === 0) {
      inputEl.className = 'drinker-input';
    } else if (isValid) {
      inputEl.className = 'drinker-input valid';
    } else {
      inputEl.className = 'drinker-input invalid';
    }

    // Update enter button
    const enterBtn = document.getElementById('drinkerEnterBtn');
    if (enterBtn) {
      enterBtn.disabled = !isValid;
    }

    // Show generated ID preview
    const preview = document.getElementById('generatedIdPreview');
    const previewId = document.getElementById('previewId');
    if (preview && previewId) {
      if (isValid) {
        const generatedId = generateId(value);
        previewId.textContent = generatedId;
        preview.classList.add('visible');
      } else {
        preview.classList.remove('visible');
      }
    }
  }

  function updateRule(ruleId, isMet) {
    const rule = document.getElementById(ruleId);
    if (rule) {
      rule.classList.toggle('met', isMet);
      rule.classList.toggle('unmet', !isMet);
    }
  }

  /**
   * Generate unique drinker ID
   * Format: DrinkerName_HHMMSS_DDMMYYYY
   * Example: Vipul@@143_152633_11042026
   */
  function generateId(name) {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const year = now.getFullYear();

    return `${name}_${hours}${minutes}${seconds}_${day}${month}${year}`;
  }

  function onEnter() {
    if (!isValid) return;

    const input = document.getElementById('drinkerNameInput');
    if (!input) return;

    const name = input.value.trim();
    const id = generateId(name);

    // Set session in App
    App.setSession(name, id);

    // Hide dialog
    hide();

    // Show welcome toast
    App.showToast(`🍺 Welcome, ${name}! Time to be unprofessional.`, 'success');
  }

  return {
    show,
    hide,
  };
})();
