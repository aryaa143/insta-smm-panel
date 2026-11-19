const db = require('../config/db');

const create = async ({ userId, serviceId, link, quantity, charge }) => {
  const res = await db.query(
    `INSERT INTO orders (user_id, service_id, link, quantity, charge, status)
     VALUES ($1, $2, $3, $4, $5, 'pending')
     RETURNING *`,
    [userId, serviceId, link, quantity, charge]
  );
  return res.rows[0];
};

const findById = async (id) => {
  const res = await db.query('SELECT * FROM orders WHERE id = $1', [id]);
  return res.rows[0] || null;
};

const listForUser = async (userId) => {
  const res = await db.query(
    `SELECT o.*, s.name AS service_name
     FROM orders o
     JOIN services s ON s.id = o.service_id
     WHERE o.user_id = $1
     ORDER BY o.created_at DESC`,
    [userId]
  );
  return res.rows;
};

const listAll = async ({ status } = {}) => {
  let sql = `
    SELECT o.*, s.name AS service_name, u.name AS user_name, u.email AS user_email
    FROM orders o
    JOIN services s ON s.id = o.service_id
    JOIN users u ON u.id = o.user_id
  `;
  const params = [];
  if (status) {
    sql += ' WHERE o.status = $1';
    params.push(status);
  }
  sql += ' ORDER BY o.created_at DESC LIMIT 500';
  const res = await db.query(sql, params);
  return res.rows;
};

const setProviderOrderId = async (id, providerOrderId, status = 'processing') => {
  await db.query(
    `UPDATE orders
     SET provider_order_id = $1, status = $2, updated_at = CURRENT_TIMESTAMP
     WHERE id = $3`,
    [providerOrderId, status, id]
  );
};

const updateStatusFields = async (id, { status, start_count, remains }) => {
  await db.query(
    `UPDATE orders
     SET status = COALESCE($1, status),
         start_count = COALESCE($2, start_count),
         remains = COALESCE($3, remains),
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $4`,
    [status ?? null, start_count ?? null, remains ?? null, id]
  );
};

const setStatus = async (id, status, note = null) => {
  await db.query(
    `UPDATE orders
     SET status = $1,
         note = COALESCE($2, note),
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $3`,
    [status, note, id]
  );
};

const countByStatus = async () => {
  const res = await db.query(
    'SELECT status, COUNT(*)::int AS n FROM orders GROUP BY status'
  );
  return res.rows;
};

const sumCompletedRevenue = async () => {
  const res = await db.query(
    "SELECT COALESCE(SUM(charge), 0)::float AS total FROM orders WHERE status != 'canceled'"
  );
  return res.rows[0] ? res.rows[0].total : 0;
};

const listOpenWithProviderId = async () => {
  const res = await db.query(`
    SELECT * FROM orders
    WHERE provider_order_id IS NOT NULL
      AND status NOT IN ('completed', 'canceled', 'failed')
  `);
  return res.rows;
};

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