// backend/routes/playlists.js
const express = require('express');
const axios = require('axios');
const Playlist = require('../models/Playlist');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();

/**
 * @route   GET /api/playlists/import
 * @desc    Fetch user’s Spotify playlists and upsert into DB
 * @access  Private
 */
router.get('/import', authMiddleware, async (req, res) => {
  try {
    const user = req.user;  // from authMiddleware

    // 1) Refresh token if expired
    if (new Date() >= user.tokenExpiresAt) {
      const tokenResponse = await axios({
        method: 'post',
        url: 'https://accounts.spotify.com/api/token',
        data: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: user.refreshToken,
        }).toString(),
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization:
            'Basic ' +
            Buffer.from(
              `${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`
            ).toString('base64'),
        },
      });
      user.accessToken = tokenResponse.data.access_token;
      user.tokenExpiresAt = new Date(Date.now() + tokenResponse.data.expires_in * 1000);
      await user.save();
    }

    // 2) Fetch playlists from Spotify API
    const spotifyRes = await axios.get(
      'https://api.spotify.com/v1/me/playlists?limit=50',
      { headers: { Authorization: `Bearer ${user.accessToken}` } }
    );

    const imported = [];

    // 3) Upsert each playlist
    for (const item of spotifyRes.data.items) {
      // Build the data blob
      const playlistData = {
        spotifyPlaylistId: item.id,
        name: item.name,
        description: item.description || '',
        coverImage: 
          (Array.isArray(item.images) && item.images.length > 0
            ? item.images[0].url
            : ''
          ),
        owner: {
          _id: user._id,
          displayName: user.displayName,
        },
        trackCount: item.tracks.total,
        isPublic: item.public,
      };

      // Fetch up to first 100 tracks
      const tracksRes = await axios.get(
        `https://api.spotify.com/v1/playlists/${item.id}/tracks?limit=100`,
        { headers: { Authorization: `Bearer ${user.accessToken}` } }
      );
      playlistData.tracks = tracksRes.data.items
        .filter(item => item.track)
        .map(item => ({
          trackId: item.track.id,
          name: item.track.name,
          artist: item.track.artists.map(a => a.name).join(', '),
          duration: millisToMinutesAndSeconds(item.track.duration_ms),
        }));

      // Upsert in one atomic operation:
      const upserted = await Playlist.findOneAndUpdate(
        { spotifyPlaylistId: item.id },      // query by Spotify ID
        { $set: playlistData },               // update these fields
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );

      imported.push(upserted);
    }

    return res.json({ message: 'Playlists imported', playlists: imported });
  } catch (err) {
    console.error('Error importing playlists:', err.response?.data || err.message);
    return res.status(500).json({ message: 'Failed to import playlists' });
  }
});

/**
 * @route   GET /api/playlists
 * @desc    List all public playlists (for feed), sorted by newest first
 * @access  Public
 */
router.get('/', async (req, res) => {
  try {
    const playlists = await Playlist.find({ isPublic: true })
      .sort({ createdAt: -1 })
      .limit(50);
    res.json(playlists);
  } catch (err) {
    console.error('Error fetching playlists:', err);
    res.status(500).json({ message: 'Failed to fetch playlists' });
  }
});

/**
 * @route   GET /api/playlists/song-of-the-day
 * @desc    Pick today’s track from your imported playlists
 * @access  Private
 */
router.get(
  '/song-of-the-day',
  authMiddleware,
  async (req, res) => {
    try {
      // 1) Load all your playlists
      const pls = await Playlist.find({ 'owner._id': req.user._id });
      // 2) Flatten all tracks into one array
      const allTracks = pls.flatMap(pl => pl.tracks);
      if (allTracks.length === 0) {
        return res.status(404).json({ message: 'No tracks available' });
      }
      // 3) Pick by day-of-month mod length
      const day = new Date().getDate(); // 1–31
      const idx = day % allTracks.length;
      const track = allTracks[idx];
      res.json(track);
    } catch (err) {
      console.error('Error fetching Song of the Day:', err);
      res.status(500).json({ message: 'Failed to fetch song of the day' });
    }
  }
);

/**
 * @route   GET /api/playlists/:id
 * @desc    Get a single playlist by its DB _id
 * @access  Public
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    let playlist;

    // if it's a valid Mongo ObjectId, search by _id
    if (require('mongoose').Types.ObjectId.isValid(id)) {
      playlist = await Playlist.findById(id);
    } else {
      // otherwise treat it as a Spotify playlist ID
      playlist = await Playlist.findOne({ spotifyPlaylistId: id });
    }

    if (!playlist) {
      return res.status(404).json({ message: 'Playlist not found' });
    }
    res.json(playlist);
  } catch (err) {
    console.error('Error fetching playlist:', err);
    res.status(500).json({ message: 'Failed to fetch playlist' });
  }
});

/**
 * @route   POST /api/playlists/:id/like
 * @desc    Increment the like count on a playlist
 * @access  Private
 */
router.post('/:id/like', authMiddleware, async (req, res) => {
  try {
    const playlist = await Playlist.findById(req.params.id);
    if (!playlist) return res.status(404).json({ message: 'Playlist not found' });
    playlist.likes += 1;
    await playlist.save();
    res.json({ likes: playlist.likes });
  } catch (err) {
    console.error('Error liking playlist:', err);
    res.status(500).json({ message: 'Failed to like playlist' });
  }
});


module.exports = router;

// Helper: Convert milliseconds to “M:SS”
function millisToMinutesAndSeconds(ms) {
  const minutes = Math.floor(ms / 60000);
  const seconds = ((ms % 60000) / 1000).toFixed(0);
  return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
}
