const express = require('express');
const Comment = require('../models/Comment');
const Playlist = require('../models/Playlist');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();

/**
 * @route   POST /api/comments/:playlistId
 * @desc    Add a comment to a playlist
 * @access  Private
 */
router.post('/:playlistId', authMiddleware, async (req, res) => {
  try {
    const { text } = req.body;
    const playlist = await Playlist.findById(req.params.playlistId);
    if (!playlist) return res.status(404).json({ message: 'Playlist not found' });

    // Create comment document
    const newComment = new Comment({
      playlist: playlist._id,
      user: {
        _id: req.user._id,
        displayName: req.user.displayName,
        // avatarUrl: req.user.avatarUrl (if you store an avatar)  
      },
      text,
    });
    await newComment.save();

    // Increment playlist’s commentCount
    playlist.commentsCount += 1;
    await playlist.save();

    res.json(newComment);
  } catch (err) {
    console.error('Error adding comment:', err);
    res.status(500).json({ message: 'Failed to add comment' });
  }
});

/**
 * @route   GET /api/comments/:playlistId
 * @desc    Get all comments for a given playlist (descending time)
 * @access  Public
 */
router.get('/:playlistId', async (req, res) => {
  try {
    const comments = await Comment.find({ playlist: req.params.playlistId })
      .sort({ timestamp: -1 })
      .limit(100);
    res.json(comments);
  } catch (err) {
    console.error('Error fetching comments:', err);
    res.status(500).json({ message: 'Failed to fetch comments' });
  }
});

/**
 * @route   POST /api/comments/:commentId/like
 * @desc    Increment a comment’s like count
 * @access  Private
 */
router.post('/:commentId/like', authMiddleware, async (req, res) => {
  try {
    const comment = await Comment.findById(req.params.commentId);
    if (!comment) return res.status(404).json({ message: 'Comment not found' });
    comment.likes += 1;
    await comment.save();
    res.json({ likes: comment.likes });
  } catch (err) {
    console.error('Error liking comment:', err);
    res.status(500).json({ message: 'Failed to like comment' });
  }
});

module.exports = router;
