const mongoose = require('mongoose');
const { Schema } = mongoose;

// If you need the ObjectId type directly:
const ObjectId = Schema.Types.ObjectId;

const trackSchema = new Schema({
  trackId:   String,
  name:      String,
  artist:    String,
  duration:  String
});

const playlistSchema = new Schema({
  spotifyPlaylistId: { type: String, required: true, unique: true },
  name:              String,
  description:       String,
  coverImage:        String,
  owner: {
    _id:         { type: ObjectId, ref: 'User' },
    displayName: String
  },
  trackCount:    Number,
  isPublic:      Boolean,
  tracks:        [trackSchema],
  likes:         { type: Number, default: 0 },
  commentsCount: { type: Number, default: 0 },
  // If you’re using a shared-with feature:
  sharedWith:    [{ type: ObjectId, ref: 'User' }],
  createdAt:     { type: Date, default: Date.now }
});

module.exports = mongoose.model('Playlist', playlistSchema);
