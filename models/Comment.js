const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  playlist: { type: mongoose.Schema.Types.ObjectId, ref: 'Playlist', required: true },
  user: {
    _id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    displayName: String,
    avatarUrl: String  // optional
  },
  text: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
  likes: { type: Number, default: 0 }
});
module.exports = mongoose.model('Comment', schema);
