CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user',       -- 'user' | 'admin'
  wallet_balance REAL NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active',   -- 'active' | 'banned'
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS services (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
  provider_service_id TEXT,
  name TEXT NOT NULL,
  description TEXT,
  rate_per_1000 REAL NOT NULL,
  provider_rate_per_1000 REAL,
  min_quantity INTEGER NOT NULL DEFAULT 100,
  max_quantity INTEGER NOT NULL DEFAULT 10000,
  status TEXT NOT NULL DEFAULT 'active',   -- 'active' | 'disabled'
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  service_id INTEGER NOT NULL REFERENCES services(id),
  link TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  charge REAL NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',  -- pending|processing|in_progress|completed|partial|canceled|failed
  provider_order_id TEXT,
  start_count INTEGER,
  remains INTEGER,
  note TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  type TEXT NOT NULL,                      -- deposit|order|refund|admin_adjust
  amount REAL NOT NULL,                    -- positive = credit, negative = debit
  balance_after REAL NOT NULL,
  note TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS fund_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  amount REAL NOT NULL,
  method TEXT NOT NULL,                    -- bank_transfer|upi|other
  reference TEXT,
  status TEXT NOT NULL DEFAULT 'pending',  -- pending|approved|rejected
  admin_note TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  reviewed_at TEXT
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT
);

CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_transactions_user ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_fund_requests_status ON fund_requests(status);
