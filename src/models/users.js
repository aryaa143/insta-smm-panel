const db = require('../config/db');

const findByEmail = (email) =>
  db.prepare('SELECT * FROM users WHERE email = ?').get(String(email).toLowerCase().trim());

const findById = (id) => db.prepare('SELECT * FROM users WHERE id = ?').get(id);

const create = ({ name, email, passwordHash }) => {
  const info = db
    .prepare('INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)')
    .run(name, String(email).toLowerCase().trim(), passwordHash);
  return findById(info.lastInsertRowid);
};

const listAll = () => db.prepare('SELECT * FROM users ORDER BY created_at DESC').all();

const setStatus = (id, status) => db.prepare('UPDATE users SET status = ? WHERE id = ?').run(status, id);

const countAll = () => db.prepare('SELECT COUNT(*) AS n FROM users').get().n;

// Adjusts a user's wallet balance atomically and records a transaction row.
// amount: positive to credit, negative to debit. Throws if a debit would
// take the balance below zero.
const adjustBalance = db.transaction((userId, amount, type, note = '') => {
  const user = db.prepare('SELECT wallet_balance FROM users WHERE id = ?').get(userId);
  if (!user) throw new Error('User not found');
  const newBalance = Math.round((user.wallet_balance + amount) * 100) / 100;
  if (newBalance < 0) throw new Error('Insufficient wallet balance');
  db.prepare('UPDATE users SET wallet_balance = ? WHERE id = ?').run(newBalance, userId);
  db.prepare(
    'INSERT INTO transactions (user_id, type, amount, balance_after, note) VALUES (?, ?, ?, ?, ?)'
  ).run(userId, type, amount, newBalance, note);
  return newBalance;
});

module.exports = { findByEmail, findById, create, listAll, setStatus, countAll, adjustBalance };
