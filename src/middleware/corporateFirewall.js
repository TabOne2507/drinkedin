/**
 * The Corporate Firewall™
 * Detects and blocks professional/corporate content with snarky messaging.
 * Three-tier system: Instant block, Contextual flag, Soft warning.
 */

// Tier 1: Instant rejection keywords/phrases
const TIER1_PATTERNS = [
  /now\s+hiring/i,
  /we(?:'re|[\s]+are)\s+hiring/i,
  /join\s+our\s+team/i,
  /we(?:'re|[\s]+are)\s+growing/i,
  /career\s+opportunit/i,
  /apply\s+now/i,
  /job\s+opening/i,
  /job\s+posting/i,
  /looking\s+for\s+(?:a\s+)?(?:senior|junior|lead|staff|principal)/i,
  /open\s+position/i,
  /open\s+role/i,
  /hiring\s+for/i,
  /recruiting\s+for/i,
  /talent\s+acquisition/i,
  /send\s+(?:me\s+)?your\s+(?:resume|cv)/i,
  /check\s+out\s+(?:this|our)\s+job/i,
  /job\s+description/i,
  /compensation\s+package/i,
  /referral\s+bonus/i,
];

// Tier 2: Contextual flag phrases
const TIER2_PATTERNS = [
  /excited\s+to\s+(?:announce|share)/i,
  /thrilled\s+to\s+(?:announce|share|join)/i,
  /new\s+(?:role|position|chapter|journey|beginning)/i,
  /professional\s+journey/i,
  /career\s+(?:journey|growth|path|milestone)/i,
  /proud\s+to\s+(?:announce|share)/i,
  /humbled?\s+(?:and\s+)?(?:honored|grateful)/i,
  /thought\s+leadership/i,
  /industry\s+leader/i,
  /grateful\s+for\s+(?:this|the)\s+opportunit/i,
  /synerg/i,
  /paradigm\s+shift/i,
  /circle\s+back/i,
  /low[- ]hanging\s+fruit/i,
  /move\s+the\s+needle/i,
  /value\s+proposition/i,
  /leverage\s+(?:our|the|my)/i,
  /disrupt(?:ive|ing|ion)/i,
  /blockchain\s+(?:will|is|can)\s+revolution/i,
  /ai\s+(?:will|is)\s+(?:transform|revolution|disrupt)/i,
];

// Tier 3: Corporate buzzwords (for density check)
const CORPORATE_BUZZWORDS = [
  'synergy', 'bandwidth', 'leverage', 'pipeline', 'ecosystem',
  'scalable', 'deliverable', 'stakeholder', 'actionable', 'optimize',
  'streamline', 'innovative', 'disruptive', 'agile', 'robust',
  'holistic', 'granular', 'paradigm', 'vertical', 'horizontal',
  'onboard', 'offboard', 'upskill', 'reskill', 'empower',
  'alignment', 'touchpoint', 'mindshare', 'thought-leader', 'best-practice',
  'value-add', 'deep-dive', 'drill-down', 'circle-back', 'take-offline',
  'low-hanging-fruit', 'move-the-needle', 'north-star', 'game-changer',
  'pain-point', 'use-case', 'end-to-end', 'full-stack', 'cross-functional',
  'kpi', 'roi', 'saas', 'b2b', 'b2c', 'mvp', 'okr',
  'sprint', 'standup', 'retro', 'backlog', 'runway',
  'pivot', 'iterate', 'double-down', 'table-stakes',
];

// Snarky rejection messages
const TIER1_MESSAGES = [
  "🚫 Whoa there, recruiter! This looks like a job posting. Take that toxicity to LinkedIn where it belongs.",
  "🚫 We detected corporate recruitment energy. DrinkedIn is a job-free zone. Go away, HR.",
  "🚫 Nice try, but we don't do 'career opportunities' here. Try posting about your hangover instead.",
  "🚫 REJECTED. This smells like a LinkedIn post. Were you dropped on your head by a talent acquisition team?",
];

const TIER2_MESSAGES = [
  "⚠️ Hmm, this sounds suspiciously professional. Are you sure you're not lost? LinkedIn is that way 👉",
  "⚠️ 'Excited to announce'? Sounds like LinkedIn brain rot. Rephrase it like a human, not a corporate bot.",
  "⚠️ We're picking up strong corporate vibes. Maybe tone down the buzzwords and add more chaos?",
  "⚠️ This post has concerning levels of professionalism. Consider adding a rant about your boss instead.",
];

const TIER3_MESSAGES = [
  "🤔 Are you okay? This sounds dangerously close to a LinkedIn post. Corporate jargon density is HIGH.",
  "🤔 Buzzword alert! Your post is 40%+ corporate speak. Maybe replace 'synergy' with 'beer'?",
  "🤔 Feeling the corporate urge? Take a deep breath and remember: nobody here cares about your KPIs.",
];

function getRandomMessage(messages) {
  return messages[Math.floor(Math.random() * messages.length)];
}

/**
 * Calculate corporate buzzword density in text
 */
function calculateBuzzwordDensity(text) {
  const words = text.toLowerCase().replace(/[^a-z0-9\s-]/g, '').split(/\s+/);
  if (words.length === 0) return 0;

  let buzzwordCount = 0;
  for (const word of words) {
    if (CORPORATE_BUZZWORDS.includes(word) || CORPORATE_BUZZWORDS.includes(word.replace(/-/g, ''))) {
      buzzwordCount++;
    }
  }

  return buzzwordCount / words.length;
}

/**
 * The Corporate Firewall™ middleware
 * Checks post content against three tiers of corporate detection
 */
function corporateFirewall(req, res, next) {
  const content = req.body.content;

  if (!content || typeof content !== 'string') {
    return next();
  }

  // Tier 1: Instant rejection
  for (const pattern of TIER1_PATTERNS) {
    if (pattern.test(content)) {
      return res.status(422).json({
        blocked: true,
        tier: 1,
        message: getRandomMessage(TIER1_MESSAGES),
        action: 'blocked',
        suggestion: 'Try posting about your weekend plans, office drama, or existential dread instead.',
      });
    }
  }

  // Tier 2: Contextual flag
  let tier2Matches = 0;
  for (const pattern of TIER2_PATTERNS) {
    if (pattern.test(content)) {
      tier2Matches++;
    }
  }

  if (tier2Matches >= 2) {
    return res.status(422).json({
      blocked: true,
      tier: 2,
      message: getRandomMessage(TIER2_MESSAGES),
      action: 'blocked',
      suggestion: 'Your post triggered multiple corporate content flags. Rewrite it like you\'re texting your friend, not your boss.',
    });
  }

  if (tier2Matches === 1) {
    // Allow but warn - attach warning to response
    req.corporateWarning = {
      tier: 2,
      message: getRandomMessage(TIER2_MESSAGES),
    };
  }

  // Tier 3: Buzzword density check
  const density = calculateBuzzwordDensity(content);
  if (density > 0.4) {
    return res.status(422).json({
      blocked: true,
      tier: 3,
      message: getRandomMessage(TIER3_MESSAGES),
      action: 'blocked',
      density: `${Math.round(density * 100)}%`,
      suggestion: 'Over 40% of your words are corporate jargon. You need a drink, not a post.',
    });
  }

  if (density > 0.2) {
    req.corporateWarning = {
      tier: 3,
      message: getRandomMessage(TIER3_MESSAGES),
      density: `${Math.round(density * 100)}%`,
    };
  }

  next();
}

/**
 * Client-side validation data export
 * Returns the patterns for client-side pre-check
 */
function getClientValidationData() {
  return {
    tier1Keywords: [
      'now hiring', 'we\'re hiring', 'join our team', 'career opportunity',
      'apply now', 'job opening', 'job posting', 'open position', 'open role',
      'hiring for', 'recruiting for', 'talent acquisition', 'send your resume',
      'job description', 'compensation package', 'referral bonus',
    ],
    tier2Keywords: [
      'excited to announce', 'thrilled to share', 'new role', 'new chapter',
      'professional journey', 'thought leadership', 'synergy', 'paradigm shift',
      'circle back', 'low-hanging fruit', 'move the needle', 'value proposition',
    ],
    buzzwords: CORPORATE_BUZZWORDS,
  };
}

module.exports = {
  corporateFirewall,
  getClientValidationData,
};
