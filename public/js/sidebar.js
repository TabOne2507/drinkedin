/**
 * DrinkedIn - Sidebar Module
 * Manages left sidebar (profile, rage meter) and right sidebar (trending, rage rooms)
 */

const Sidebar = (() => {
  // Vibes list for random assignment
  const VIBES = [
    '☕ Currently caffeinated',
    '🍺 Pre-gaming the standup',
    '😤 Rage level: elevated',
    '🫠 Melting under deadlines',
    '🌅 Surviving Monday',
    '💀 Dead inside, alive outside',
    '🧊 Cool as a cucumber (lying)',
    '🔥 On fire (not the good kind)',
    '🎭 Wearing my corporate mask',
    '🫣 One meeting away from quitting',
    '🍷 Wine o\'clock energy',
    '😴 Running on fumes and spite',
    '🎪 Working in a circus (literally)',
    '🏃 Sprinting to Friday',
    '⚡ Powered by anxiety and coffee',
  ];

  // Rage meter levels
  const RAGE_LEVELS = [
    { min: 0, max: 0, label: 'Post something to start raging!', badge: null },
    { min: 1, max: 2, label: 'Warming up... keep going!', badge: '🌱 Baby Ranter' },
    { min: 3, max: 5, label: 'Getting heated! 🔥', badge: '🔥 On Fire' },
    { min: 6, max: 9, label: 'MAXIMUM RAGE MODE!!! 🌋', badge: '🌋 Rage Monster' },
    { min: 10, max: 14, label: 'You might need therapy... 🛋️', badge: '🛋️ Therapy Badge' },
    { min: 15, max: Infinity, label: 'LEGENDARY RANTER! Touch grass!', badge: '👑 Rage Royalty' },
  ];

  function init() {
    setRandomVibe();
    updateRageMeter(0);
  }

  /**
   * Set a random "Current Vibe" in the profile card
   */
  function setRandomVibe() {
    const vibeEl = document.getElementById('profileVibe');
    if (vibeEl) {
      const randomVibe = VIBES[Math.floor(Math.random() * VIBES.length)];
      vibeEl.textContent = randomVibe;
    }
  }

  /**
   * Update the Rage Meter widget based on rant count
   */
  function updateRageMeter(rantCount) {
    const fill = document.getElementById('rageBarFill');
    const label = document.getElementById('rageMeterLabel');
    const badge = document.getElementById('rageBadge');

    // Calculate rage percentage (caps at 15 for 100%)
    const maxRants = 15;
    const percentage = Math.min((rantCount / maxRants) * 100, 100);

    if (fill) {
      fill.style.width = `${percentage}%`;
    }

    // Find current level
    const level = RAGE_LEVELS.find(l => rantCount >= l.min && rantCount <= l.max);
    if (level) {
      if (label) label.textContent = level.label;

      if (badge) {
        if (level.badge) {
          badge.textContent = level.badge;
          badge.classList.remove('hidden');
        } else {
          badge.classList.add('hidden');
        }
      }
    }

    // Update stats
    const statRants = document.getElementById('statRants');
    if (statRants) statRants.textContent = rantCount;
  }

  return {
    init,
    updateRageMeter,
    setRandomVibe,
  };
})();
