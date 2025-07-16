const express = require('express');
const authMiddleware = require('../middleware/authMiddleware');
const router = express.Router();

router.get('/me', authMiddleware, (req, res) => {
  const { _id, spotifyId, displayName, email, avatarUrl } = req.user;
  res.json({ _id, spotifyId, displayName, email, avatarUrl });
});

/**
 * @route   PUT /api/users/me
 * @desc    Update current user’s profile (e.g. displayName)
 * @access  Private
 */
router.put('/me', authMiddleware, async (req, res) => {
  const { displayName } = req.body;
  if (displayName) {
    req.user.displayName = displayName;
    await req.user.save();
  }
  res.json({ displayName: req.user.displayName });
});

module.exports = router;
