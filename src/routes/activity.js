/**
 * DrinkedIn - Public activity endpoint
 * The client calls this when a drinker enters the app.
 */

const express = require('express');
const tracking = require('../services/tracking');

const router = express.Router();

router.post('/session', async (req, res) => {
  const { drinker_id, drinker_name, resumed } = req.body || {};

  if (!drinker_id || typeof drinker_id !== 'string' || drinker_id.length > 200) {
    return res.status(400).json({ error: 'A valid drinker_id is required.' });
  }

  await tracking.recordSession(req, {
    drinker_id,
    drinker_name: typeof drinker_name === 'string' ? drinker_name : '',
    resumed: !!resumed,
  });

  res.json({ success: true });
});

module.exports = { router };
