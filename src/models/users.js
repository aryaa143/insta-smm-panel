const db = require('../config/db');

const findByEmail = async (email) => {
  const res = await db.query(
    'SELECT * FROM users WHERE email = $1',
    [String(email).toLowerCase().trim()]
  );
  return res.rows[0] || null;
};

const findById = async (id) => {
  const res = await db.query('SELECT * FROM users WHERE id = $1', [id]);
  return res.rows[0] || null;
};

const create = async ({ name, email, passwordHash }) => {
  const res = await db.query(
    `INSERT INTO users (name, email, password_hash)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [name, String(email).toLowerCase().trim(), passwordHash]
  );
  return res.rows[0];
};

const listAll = async () => {
  const res = await db.query('SELECT * FROM users ORDER BY created_at DESC');
  return res.rows;
};

const setStatus = async (id, status) => {
  await db.query('UPDATE users SET status = $1 WHERE id = $2', [status, id]);
};

const countAll = async () => {
  const res = await db.query('SELECT COUNT(*)::int AS n FROM users');
  return res.rows[0] ? res.rows[0].n : 0;
};

// Adjusts a user's wallet balance atomically and records a transaction row.
// amount: positive to credit, negative to debit. Throws if a debit would
// take the balance below zero.
const adjustBalance = async (userId, amount, type, note = '') => {
  const client = await db.connect();
  try {
    await client.query('BEGIN');

    const userRes = await client.query(
      'SELECT wallet_balance FROM users WHERE id = $1 FOR UPDATE',
      [userId]
    );
    const user = userRes.rows[0];
    if (!user) throw new Error('User not found');

    const currentBalance = Number(user.wallet_balance) || 0;
    const newBalance = Math.round((currentBalance + Number(amount)) * 100) / 100;
    if (newBalance < 0) throw new Error('Insufficient wallet balance');

    await client.query(
      'UPDATE users SET wallet_balance = $1 WHERE id = $2',
      [newBalance, userId]
    );

    await client.query(
      `INSERT INTO transactions (user_id, type, amount, balance_after, note)
       VALUES ($1, $2, $3, $4, $5)`,
      [userId, type, amount, newBalance, note]
    );

    await client.query('COMMIT');
    return newBalance;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

module.exports = { findByEmail, findById, create, listAll, setStatus, countAll, adjustBalance };