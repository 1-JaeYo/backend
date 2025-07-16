const jwt  = require('jsonwebtoken');
const User = require('../models/User');

module.exports = async function (req, res, next) {
  try {
    const token = (req.headers.authorization || '').split(' ')[1];
    if (!token) return res.status(401).json({ message: 'No token' });
    const { userId } = jwt.verify(token, process.env.JWT_SECRET);
    req.user = await User.findById(userId);
    if (!req.user) throw new Error('User not found');
    next();
  } catch {
    res.status(401).json({ message: 'Invalid or missing token' });
  }
};
