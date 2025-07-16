// backend/routes/auth.js
const express = require('express');
const authMiddleware = require('../middleware/authMiddleware');
const axios = require('axios');
const querystring = require('querystring');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const router = express.Router();

router.get('/login', (req, res) => {
  const scope = [
    'user-read-email',
    'playlist-read-private',
    'playlist-read-collaborative',
  ].join(' ');

  const params = querystring.stringify({
    response_type: 'code',
    client_id:     process.env.SPOTIFY_CLIENT_ID,
    scope,
    redirect_uri:  process.env.SPOTIFY_REDIRECT_URI,
  });

  res.redirect(`https://accounts.spotify.com/authorize?${params}`);
});

router.get('/callback', async (req, res) => {
  const code = req.query.code || null;

  try {
    // Exchange code for Spotify tokens
    const tokenRes = await axios.post(
      'https://accounts.spotify.com/api/token',
      querystring.stringify({
        grant_type:    'authorization_code',
        code,
        redirect_uri:  process.env.SPOTIFY_REDIRECT_URI,
      }),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization:
            'Basic ' +
            Buffer.from(
              `${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`
            ).toString('base64'),
        },
      }
    );

    const { access_token, refresh_token, expires_in } = tokenRes.data;

    // Fetch Spotify user profile
    const profileRes = await axios.get('https://api.spotify.com/v1/me', {
      headers: { Authorization: `Bearer ${access_token}` },
    });
    const { id: spotifyId, display_name, email, images } = profileRes.data;
    const avatarUrl = images[0]?.url || null;

    // Upsert user in MongoDB
    let user = await User.findOne({ spotifyId });
    const tokenExpiresAt = new Date(Date.now() + expires_in * 1000);

    if (!user) {
      user = new User({
        spotifyId,
        displayName: display_name,
        email,
        accessToken: access_token,
        avatarUrl,
        refreshToken: refresh_token,
        tokenExpiresAt,
      });
    } else {
      user.displayName = display_name;
      user.email = email;
      user.avatarUrl = avatarUrl;
      user.accessToken = access_token;
      user.refreshToken = refresh_token;
      user.tokenExpiresAt = tokenExpiresAt;
    }
    await user.save();

    // Issue our own JWT for the frontend
    const payload  = { userId: user._id, spotifyId: user.spotifyId };
    const appToken = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '7d' });

    // Redirect back to React with ?token=<JWT>
    res.redirect(`${process.env.FRONTEND_URI}/?token=${appToken}`);
  } catch (err) {
    console.error('Spotify OAuth error:', err.response?.data || err.message);
    return res.redirect(`${process.env.FRONTEND_URI}/?error=${err.response?.data.error || 'auth_failed'}`);
  }
});

/**
 * @route   POST /api/auth/logout
 * @desc    Clear stored Spotify tokens for the current user
 * @access  Private
 */
router.post('/logout', authMiddleware, async (req, res) => {
  try {
    const user = req.user;
    // Remove tokens from our DB
    user.accessToken = null;
    user.refreshToken = null;
    user.tokenExpiresAt = null;
    await user.save();
    res.json({ message: 'Logged out successfully' });
  } catch (err) {
    console.error('Logout error:', err);
    res.status(500).json({ message: 'Failed to log out' });
  }
});

module.exports = router;
