const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  spotifyId: { type: String, required: true, unique: true },
  displayName: String,
  email: String,
  avatarUrl:     String,
  accessToken: String,
  refreshToken: String,
  tokenExpiresAt: Date,
  createdAt: { type: Date, default: Date.now }
});
module.exports = mongoose.model('User', schema);
