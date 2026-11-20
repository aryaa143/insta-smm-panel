require('dotenv').config();
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const db = require('./db');

async function initDb() {
  const schemaPath = path.join(__dirname, 'schema.sql');
  const schema = fs.readFileSync(schemaPath, 'utf8');
  await db.query(schema);
await db.query(`
    CREATE TABLE IF NOT EXISTS session (
      sid varchar NOT NULL PRIMARY KEY,
      sess json NOT NULL,
      expire timestamp(6) NOT NULL
    )
  `);
  const adminEmail = (process.env.ADMIN_EMAIL || 'akashkushwaha14385@gmail.com').toLowerCase();
  const existingAdminRes = await db.query('SELECT id FROM users WHERE email = $1', [adminEmail]);

  if (existingAdminRes.rows.length === 0) {
    const passwordHash = bcrypt.hashSync(process.env.ADMIN_PASSWORD || 'akashpriya21012024', 10);
    await db.query(
      `INSERT INTO users (name, email, password_hash, role, wallet_balance, status)
       VALUES ($1, $2, $3, 'admin', 0, 'active')`,
      [process.env.ADMIN_NAME || 'Admin', adminEmail, passwordHash]
    );
    console.log(`Admin account created: ${adminEmail}`);
  } else {
    console.log(`Admin account already exists: ${adminEmail}`);
  }

  const starterCategories = [
    'Instagram Followers',
    'Instagram Likes',
    'Instagram Views',
    'Instagram Comments',
    'Instagram Story / Reel',
  ];

  for (let i = 0; i < starterCategories.length; i++) {
    await db.query(
      `INSERT INTO categories (name, sort_order) VALUES ($1, $2)
       ON CONFLICT (name) DO NOTHING`,
      [starterCategories[i], i]
    );
  }

  const defaultSettings = {
    app_name: process.env.APP_NAME || 'InstaBoost Panel',
    currency_symbol: process.env.CURRENCY_SYMBOL || '₹',
    default_markup: process.env.DEFAULT_MARKUP || '1.4',
    provider_api_url: process.env.PROVIDER_API_URL || '',
    provider_api_key: process.env.PROVIDER_API_KEY || '',
    min_deposit: '100',
    support_email: process.env.ADMIN_EMAIL || 'admin@example.com',
  };

  for (const [key, value] of Object.entries(defaultSettings)) {
    const existingSetting = await db.query('SELECT value FROM settings WHERE key = $1', [key]);
    if (existingSetting.rows.length === 0) {
      await db.query('INSERT INTO settings (key, value) VALUES ($1, $2)', [key, value]);
    }
  }

  console.log('Database initialised on Supabase PostgreSQL');
}

if (require.main === module) {
  initDb()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Failed to initialise database:', err);
      process.exit(1);
    });
}

module.exports = initDb;