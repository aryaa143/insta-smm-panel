const db = require('../config/db');

const create = ({ userId, serviceId, link, quantity, charge }) => {
  const info = db
    .prepare(
      `INSERT INTO orders (user_id, service_id, link, quantity, charge, status)
       VALUES (?, ?, ?, ?, ?, 'pending')`
    )
    .run(userId, serviceId, link, quantity, charge);
  return findById(info.lastInsertRowid);
};

const findById = (id) => db.prepare('SELECT * FROM orders WHERE id = ?').get(id);

const listForUser = (userId) =>
  db
    .prepare(
      `SELECT o.*, s.name AS service_name FROM orders o
       JOIN services s ON s.id = o.service_id
       WHERE o.user_id = ? ORDER BY o.created_at DESC`
    )
    .all(userId);

const listAll = ({ status } = {}) => {
  let sql = `SELECT o.*, s.name AS service_name, u.name AS user_name, u.email AS user_email
             FROM orders o
             JOIN services s ON s.id = o.service_id
             JOIN users u ON u.id = o.user_id`;
  const params = [];
  if (status) {
    sql += ' WHERE o.status = ?';
    params.push(status);
  }
  sql += ' ORDER BY o.created_at DESC LIMIT 500';
  return db.prepare(sql).all(...params);
};

const setProviderOrderId = (id, providerOrderId, status = 'processing') =>
  db
    .prepare(`UPDATE orders SET provider_order_id = ?, status = ?, updated_at = datetime('now') WHERE id = ?`)
    .run(providerOrderId, status, id);

const updateStatusFields = (id, { status, start_count, remains }) =>
  db
    .prepare(
      `UPDATE orders SET status = COALESCE(?, status), start_count = COALESCE(?, start_count),
        remains = COALESCE(?, remains), updated_at = datetime('now') WHERE id = ?`
    )
    .run(status ?? null, start_count ?? null, remains ?? null, id);

const setStatus = (id, status, note = null) =>
  db
    .prepare(`UPDATE orders SET status = ?, note = COALESCE(?, note), updated_at = datetime('now') WHERE id = ?`)
    .run(status, note, id);

const countByStatus = () =>
  db.prepare('SELECT status, COUNT(*) AS n FROM orders GROUP BY status').all();

const sumCompletedRevenue = () =>
  db.prepare(`SELECT COALESCE(SUM(charge), 0) AS total FROM orders WHERE status != 'canceled' AND status != 'failed'`).get()
    .total;

const listOpenWithProviderId = () =>
  db
    .prepare(
      `SELECT * FROM orders WHERE provider_order_id IS NOT NULL
       AND status NOT IN ('completed', 'canceled', 'failed')`
    )
    .all();

module.exports = {
  create,
  findById,
  listForUser,
  listAll,
  setProviderOrderId,
  updateStatusFields,
  setStatus,
  countByStatus,
  sumCompletedRevenue,
  listOpenWithProviderId,
};
