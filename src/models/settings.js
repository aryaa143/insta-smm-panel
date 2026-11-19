const db = require('../config/db');

async function getAll() {
  const res = await db.query('SELECT key, value FROM settings');
  const out = {};
  for (const r of res.rows) {
    out[r.key] = r.value;
  }
  return out;
}

async function get(key, fallback = '') {
  const res = await db.query('SELECT value FROM settings WHERE key = $1', [key]);
  const row = res.rows[0];
  return row ? row.value : fallback;
}

async function set(key, value) {
  await db.query(
    `INSERT INTO settings (key, value) VALUES ($1, $2)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
    [key, String(value)]
  );
}

async function setMany(obj) {
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    for (const [k, v] of Object.entries(obj)) {
      await client.query(
        `INSERT INTO settings (key, value) VALUES ($1, $2)
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
        [k, String(v)]
      );
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { getAll, get, set, setMany };