require('dotenv').config();
const path = require('path');
const express = require('express');
const session = require('express-session');
const helmet = require('helmet');

const { loadUser } = require('./middleware/auth');
const settingsModel = require('./models/settings');
const initDb = require('./config/initdb');
const db = require('./config/db');
const app = express();
app.set('trust proxy', 1);
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(
  helmet({
    contentSecurityPolicy: false, // keeps the Tailwind CDN + inline chart scripts simple
  })
);

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const pgSessionStore = {
  async get(sid, cb) {
    try {
      const res = await db.query(
        'SELECT sess FROM session WHERE sid = $1 AND expire > NOW()',
        [sid]
      );
      if (!res.rows.length) return cb(null, null);
      const sess = typeof res.rows[0].sess === 'string' ? JSON.parse(res.rows[0].sess) : res.rows[0].sess;
      cb(null, sess);
    } catch (err) {
      cb(err);
    }
  },
  async set(sid, sess, cb) {
    try {
      const maxAge = (sess.cookie && sess.cookie.maxAge) || 1000 * 60 * 60 * 24 * 7;
      const expire = new Date(Date.now() + maxAge);
      await db.query(
        `INSERT INTO session (sid, sess, expire)
         VALUES ($1, $2::json, $3)
         ON CONFLICT (sid) DO UPDATE SET sess = EXCLUDED.sess, expire = EXCLUDED.expire`,
        [sid, JSON.stringify(sess), expire]
      );
      cb(null);
    } catch (err) {
      cb(err);
    }
  },
  async destroy(sid, cb) {
    try {
      await db.query('DELETE FROM session WHERE sid = $1', [sid]);
      cb(null);
    } catch (err) {
      cb(err);
    }
  },
};

app.use(
  session({
    store: pgSessionStore,
    secret: process.env.SESSION_SECRET || 'dev-secret-change-me',
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
    },
  })
);

app.use(loadUser);

// One-shot flash messages (req.session.flash = { type: 'success'|'error', message }).
app.use((req, res, next) => {
  res.locals.flash = req.session.flash || null;
  delete req.session.flash;
  next();
});

// Site-wide template variables available in every view.
app.use(async (req, res, next) => {
  try {
    const settings = await settingsModel.getAll();
    res.locals.site = {
      name: settings.app_name || process.env.APP_NAME || 'InstaBoost Panel',
      currency: settings.currency_symbol || process.env.CURRENCY_SYMBOL || '₹',
      supportEmail: settings.support_email || process.env.ADMIN_EMAIL || 'support@example.com',
      url: process.env.APP_URL || 'https://insta-smm-panel.onrender.com',
    };
    res.locals.path = req.path;
    next();
  } catch (err) {
    next(err);
  }
});

app.use('/', require('./routes/auth'));
app.use('/', require('./routes/public'));
app.use('/dashboard', require('./routes/dashboard'));
app.use('/admin', require('./routes/admin'));

app.use((req, res) => {
  res.status(404).render('error', { title: 'Not found', message: "That page doesn't exist." });
});

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).render('error', {
    title: 'Something went wrong',
    message: process.env.NODE_ENV === 'production' ? 'Please try again shortly.' : err.message,
  });
});

const PORT = process.env.PORT || 3000;

initDb()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`${process.env.APP_NAME || 'InstaBoost Panel'} running at http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Startup database initialisation failed:', err);
    process.exit(1);
  });