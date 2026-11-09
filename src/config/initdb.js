// Creates the SQLite schema (if not already there) and seeds:
//  - the admin account from .env
//  - a starter set of Instagram categories (empty of services - real services
//    are pulled from YOUR upstream provider via Admin -> Services -> Sync,
//    not invented here)
//  - default site settings
//
// Safe to re-run: every step checks "does this already exist" first.
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const db = require('./db');

const dataDir = path.join(__dirname, '..', '..', 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
db.exec(schema);

// --- seed admin account ---
const adminEmail = (process.env.ADMIN_EMAIL || 'admin@example.com').toLowerCase();
const existingAdmin = db.prepare('SELECT id FROM users WHERE email = ?').get(adminEmail);

if (!existingAdmin) {
  const passwordHash = bcrypt.hashSync(process.env.ADMIN_PASSWORD || 'change-this-password', 10);
  db.prepare(
    `INSERT INTO users (name, email, password_hash, role, wallet_balance, status)
     VALUES (?, ?, ?, 'admin', 0, 'active')`
  ).run(process.env.ADMIN_NAME || 'Admin', adminEmail, passwordHash);
  console.log(`Admin account created: ${adminEmail}`);
} else {
  console.log(`Admin account already exists: ${adminEmail}`);
}

// --- seed starter categories (structure only, no invented services/prices) ---
const starterCategories = [
  'Instagram Followers',
  'Instagram Likes',
  'Instagram Views',
  'Instagram Comments',
  'Instagram Story / Reel',
];
const insertCategory = db.prepare('INSERT OR IGNORE INTO categories (name, sort_order) VALUES (?, ?)');
starterCategories.forEach((name, i) => insertCategory.run(name, i));

// --- default settings ---
const defaultSettings = {
  app_name: process.env.APP_NAME || 'InstaBoost Panel',
  currency_symbol: process.env.CURRENCY_SYMBOL || '₹',
  default_markup: process.env.DEFAULT_MARKUP || '1.4',
  provider_api_url: process.env.PROVIDER_API_URL || '',
  provider_api_key: process.env.PROVIDER_API_KEY || '',
  min_deposit: '100',
  support_email: process.env.ADMIN_EMAIL || 'admin@example.com',
};
// only fill in blanks - never clobber a value an admin already set via the UI
for (const [key, value] of Object.entries(defaultSettings)) {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  if (!row) {
    db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)').run(key, value);
  }
}

console.log('Database initialised at data/panel.db');
