const usersModel = require('../models/users');

// Loads the logged-in user (if any) onto res.locals for every request,
// so views can always check `currentUser`.
function loadUser(req, res, next) {
  if (req.session && req.session.userId) {
    const user = usersModel.findById(req.session.userId);
    if (user && user.status !== 'banned') {
      res.locals.currentUser = user;
      return next();
    }
    // stale/invalid session (user deleted or banned) - clear it
    req.session.destroy(() => next());
    return;
  }
  res.locals.currentUser = null;
  next();
}

function requireAuth(req, res, next) {
  if (!res.locals.currentUser) {
    req.session.returnTo = req.originalUrl;
    return res.redirect('/login');
  }
  next();
}

function requireAdmin(req, res, next) {
  if (!res.locals.currentUser || res.locals.currentUser.role !== 'admin') {
    return res.status(403).render('error', { title: 'Forbidden', message: 'Admins only.' });
  }
  next();
}

function redirectIfAuthed(req, res, next) {
  if (res.locals.currentUser) return res.redirect('/dashboard');
  next();
}

module.exports = { loadUser, requireAuth, requireAdmin, redirectIfAuthed };
