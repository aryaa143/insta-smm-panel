const db = require('../config/db');

const listForUser = async (userId, limit = 100) => {
  const res = await db.query(
    'SELECT * FROM transactions WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2',
    [userId, limit]
  );
  return res.rows;
};

module.exports = { listForUser };