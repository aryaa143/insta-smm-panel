const db = require('../config/db');

const create = ({ userId, amount, method, reference }) => {
  const info = db
    .prepare(
      `INSERT INTO fund_requests (user_id, amount, method, reference) VALUES (?, ?, ?, ?)`
    )
    .run(userId, amount, method, reference || null);
  return findById(info.lastInsertRowid);
};

const findById = (id) => db.prepare('SELECT * FROM fund_requests WHERE id = ?').get(id);

const listForUser = (userId) =>
  db.prepare('SELECT * FROM fund_requests WHERE user_id = ? ORDER BY created_at DESC').all(userId);

const listPending = () =>
  db
    .prepare(
      `SELECT f.*, u.name AS user_name, u.email AS user_email FROM fund_requests f
       JOIN users u ON u.id = f.user_id WHERE f.status = 'pending' ORDER BY f.created_at ASC`
    )
    .all();

const listAll = () =>
  db
    .prepare(
      `SELECT f.*, u.name AS user_name, u.email AS user_email FROM fund_requests f
       JOIN users u ON u.id = f.user_id ORDER BY f.created_at DESC LIMIT 300`
    )
    .all();

const review = (id, { status, adminNote }) =>
  db
    .prepare(
      `UPDATE fund_requests SET status = ?, admin_note = ?, reviewed_at = datetime('now') WHERE id = ?`
    )
    .run(status, adminNote || null, id);

module.exports = { create, findById, listForUser, listPending, listAll, review };
