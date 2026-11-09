const db = require('../config/db');

const listForUser = (userId, limit = 100) =>
  db
    .prepare('SELECT * FROM transactions WHERE user_id = ? ORDER BY created_at DESC LIMIT ?')
    .all(userId, limit);

module.exports = { listForUser };
