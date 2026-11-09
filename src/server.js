require('dotenv').config();
const fs = require('fs');
const path = require('path');
const express = require('express');
const session = require('express-session');
const helmet = require('helmet');

const { loadUser } = require('./middleware/auth');
const settingsModel = require('./models/settings');

// Make sure the DB exists before anything tries to query it (first run).
const dbFile = path.join(__dirname, '..', 'data', 'panel.db');
if (!fs.existsSync(dbFile)) {
  console.log('No database found - running first-time setup (src/config/initdb.js)...');
  require('./config/initdb');
}

const app = express();
app.set('trust proxy', 1);
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(
  helmet({
    contentSecurityPolicy: false, // keeps the Tailwind CDN + inline chart scripts simple; tighten for production
  })
);
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.use(
  session({
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
app.use((req, res, next) => {
  const settings = settingsModel.getAll();
  res.locals.site = {
    name: settings.app_name || 'InstaBoost Panel',
    currency: settings.currency_symbol || '₹',
    supportEmail: settings.support_email || 'support@example.com',
  };
  res.locals.path = req.path;
  next();
});

app.use('/', require('./routes/auth'));
app.use('/', require('./routes/public'));
app.use('/dashboard', require('./routes/dashboard'));
app.use('/admin', require('./routes/admin'));

app.use((req, res) => {
  res.status(404).render('error', { title: 'Not found', message: "That page doesn't exist." });
});

// eslint-disable-next-line no-unused-vars
app.use((req, res, next,) => {
  console.error(err);
  res.status(500).render('error', {
    title: 'Something went wrong',
    message: process.env.NODE_ENV === 'production' ? 'Please try again shortly.' : err.message,
  });
});
app.use((req, res, next) => {
  res.locals.site = {
    name: "SMM Panel",
    url: "https://insta-smm-panel.onrender.com"
  };
  next();
});
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`${process.env.APP_NAME || 'InstaBoost Panel'} running at http://localhost:${PORT}`);
});
