const express = require('express');
const bcrypt = require('bcryptjs');
const { body, validationResult } = require('express-validator');
const rateLimit = require('express-rate-limit');
const usersModel = require('../models/users');
const { redirectIfAuthed } = require('../middleware/auth');

const router = express.Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many attempts, please try again later.',
});

router.get('/register', redirectIfAuthed, (req, res) => {
  res.render('public/register', { title: 'Create account', errors: [], old: {} });
});

router.post(
  '/register',
  redirectIfAuthed,
  authLimiter,
  [
    body('name').trim().isLength({ min: 2, max: 80 }).withMessage('Please enter your name.'),
    body('email').trim().isEmail().withMessage('Please enter a valid email.').normalizeEmail(),
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters.'),
    body('confirmPassword').custom((value, { req }) => value === req.body.password).withMessage('Passwords do not match.'),
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).render('public/register', {
        title: 'Create account',
        errors: errors.array(),
        old: req.body,
      });
    }

    const { name, email, password } = req.body;
    if (usersModel.findByEmail(email)) {
      return res.status(400).render('public/register', {
        title: 'Create account',
        errors: [{ msg: 'An account with that email already exists.' }],
        old: req.body,
      });
    }

    const passwordHash = bcrypt.hashSync(password, 10);
    const user = usersModel.create({ name, email, passwordHash });
    req.session.userId = user.id;
    res.redirect('/dashboard');
  }
);

router.get('/login', redirectIfAuthed, (req, res) => {
  res.render('public/login', { title: 'Log in', errors: [], old: {} });
});

router.post('/login', redirectIfAuthed, authLimiter, (req, res) => {
  const { email, password } = req.body;
  const user = email ? usersModel.findByEmail(email) : null;
  const genericError = [{ msg: 'Invalid email or password.' }];

  if (!user || !bcrypt.compareSync(password || '', user.password_hash)) {
    return res.status(400).render('public/login', { title: 'Log in', errors: genericError, old: { email } });
  }
  if (user.status === 'banned') {
    return res.status(403).render('public/login', {
      title: 'Log in',
      errors: [{ msg: 'This account has been suspended. Contact support.' }],
      old: { email },
    });
  }

  req.session.userId = user.id;
  const dest = req.session.returnTo || (user.role === 'admin' ? '/admin' : '/dashboard');
  delete req.session.returnTo;
  res.redirect(dest);
});

router.post('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/'));
});

module.exports = router;
