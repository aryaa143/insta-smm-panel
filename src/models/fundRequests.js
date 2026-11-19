const db = require('../config/db');

const create = async ({ userId, amount, method, reference }) => {
  const res = await db.query(
    `INSERT INTO fund_requests (user_id, amount, method, reference)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [userId, amount, method, reference || null]
  );
  return res.rows[0];
};

const findById = async (id) => {
  const res = await db.query('SELECT * FROM fund_requests WHERE id = $1', [id]);
  return res.rows[0] || null;
};

const listForUser = async (userId) => {
  const res = await db.query(
    'SELECT * FROM fund_requests WHERE user_id = $1 ORDER BY created_at DESC',
    [userId]
  );
  return res.rows;
};

const listPending = async () => {
  const res = await db.query(`
    SELECT f.*, u.name AS user_name, u.email AS user_email
    FROM fund_requests f
    JOIN users u ON u.id = f.user_id
    WHERE f.status = 'pending'
    ORDER BY f.created_at ASC
  `);
  return res.rows;
};

const listAll = async () => {
  const res = await db.query(`
    SELECT f.*, u.name AS user_name, u.email AS user_email
    FROM fund_requests f
    JOIN users u ON u.id = f.user_id
    ORDER BY f.created_at DESC
    LIMIT 300
  `);
  return res.rows;
};

const review = async (id, { status, adminNote }) => {
  const res = await db.query(
    `UPDATE fund_requests
     SET status = $1, admin_note = $2, reviewed_at = CURRENT_TIMESTAMP::text
     WHERE id = $3
     RETURNING *`,
    [status, adminNote || null, id]
  );
  return res.rows[0] || null;
};

module.exports = { create, findById, listForUser, listPending, listAll, review };