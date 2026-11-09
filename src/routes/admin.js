const express = require('express');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const usersModel = require('../models/users');
const servicesModel = require('../models/services');
const ordersModel = require('../models/orders');
const fundRequestsModel = require('../models/fundRequests');
const settingsModel = require('../models/settings');
const providerApi = require('../services/providerApi');

const router = express.Router();
router.use(requireAuth, requireAdmin);

// ---------- Dashboard ----------
router.get('/', async (req, res) => {
  const statusCounts = ordersModel.countByStatus();
  const stats = {
    users: usersModel.countAll(),
    revenue: ordersModel.sumCompletedRevenue(),
    pendingFundRequests: fundRequestsModel.listPending().length,
    ordersByStatus: statusCounts,
  };

  let providerBalance = null;
  let providerError = null;
  if (providerApi.isConfigured()) {
    try {
      const bal = await providerApi.getBalance();
      providerBalance = bal;
    } catch (err) {
      providerError = err.message;
    }
  }

  res.render('admin/dashboard', { title: 'Admin · Dashboard', active: 'dashboard', stats, providerBalance, providerError });
});

// ---------- Users ----------
router.get('/users', (req, res) => {
  const users = usersModel.listAll();
  res.render('admin/users', { title: 'Admin · Users', active: 'users', users });
});

router.post('/users/:id/wallet-adjust', (req, res) => {
  const amount = parseFloat(req.body.amount);
  const note = (req.body.note || 'Manual adjustment by admin').trim();
  if (!amount) {
    req.session.flash = { type: 'error', message: 'Enter a non-zero amount.' };
    return res.redirect('/admin/users');
  }
  try {
    usersModel.adjustBalance(parseInt(req.params.id, 10), amount, 'admin_adjust', note);
    req.session.flash = { type: 'success', message: 'Wallet balance updated.' };
  } catch (err) {
    req.session.flash = { type: 'error', message: err.message };
  }
  res.redirect('/admin/users');
});

router.post('/users/:id/status', (req, res) => {
  const status = req.body.status === 'banned' ? 'banned' : 'active';
  usersModel.setStatus(parseInt(req.params.id, 10), status);
  req.session.flash = { type: 'success', message: `User ${status === 'banned' ? 'suspended' : 'reactivated'}.` };
  res.redirect('/admin/users');
});

// ---------- Services ----------
router.get('/services', (req, res) => {
  const services = servicesModel.listAllWithCategory();
  res.render('admin/services', {
    title: 'Admin · Services',
    active: 'services',
    services,
    providerConfigured: providerApi.isConfigured(),
  });
});

router.post('/services/sync', async (req, res) => {
  try {
    const list = await providerApi.getServices();
    const markup = parseFloat(settingsModel.get('default_markup', '1.4')) || 1.4;
    let inserted = 0;
    let updated = 0;
    for (const svc of Array.isArray(list) ? list : []) {
      const result = servicesModel.upsertFromProvider(svc, markup);
      if (result.inserted) inserted += 1;
      if (result.updated) updated += 1;
    }
    req.session.flash = {
      type: 'success',
      message: `Synced from provider: ${inserted} new service(s) added (disabled by default), ${updated} existing updated. Review pricing and enable the ones you want to sell.`,
    };
  } catch (err) {
    req.session.flash = { type: 'error', message: `Sync failed: ${err.message}` };
  }
  res.redirect('/admin/services');
});

router.get('/services/:id/edit', (req, res) => {
  const service = servicesModel.findById(req.params.id);
  if (!service) {
    req.session.flash = { type: 'error', message: 'Service not found.' };
    return res.redirect('/admin/services');
  }
  res.render('admin/service-edit', { title: 'Admin · Edit service', active: 'services', service });
});

router.post('/services/:id/update', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const existing = servicesModel.findById(id);
  if (!existing) {
    req.session.flash = { type: 'error', message: 'Service not found.' };
    return res.redirect('/admin/services');
  }
  servicesModel.update(id, {
    category_id: existing.category_id,
    name: req.body.name,
    description: req.body.description || '',
    rate_per_1000: parseFloat(req.body.rate_per_1000),
    min_quantity: parseInt(req.body.min_quantity, 10),
    max_quantity: parseInt(req.body.max_quantity, 10),
    status: req.body.status === 'active' ? 'active' : 'disabled',
  });
  req.session.flash = { type: 'success', message: `Service "${req.body.name}" updated.` };
  res.redirect('/admin/services');
});

// ---------- Orders ----------
router.get('/orders', (req, res) => {
  const status = req.query.status || undefined;
  const orders = ordersModel.listAll({ status });
  res.render('admin/orders', { title: 'Admin · Orders', active: 'orders', orders, status: status || '' });
});

router.post('/orders/:id/sync', async (req, res) => {
  const order = ordersModel.findById(req.params.id);
  if (!order || !order.provider_order_id) {
    req.session.flash = { type: 'error', message: 'Order has no provider reference.' };
    return res.redirect('/admin/orders');
  }
  try {
    const status = await providerApi.getOrderStatus(order.provider_order_id);
    ordersModel.updateStatusFields(order.id, {
      status: status.status ? status.status.toLowerCase() : undefined,
      start_count: status.start_count,
      remains: status.remains,
    });
    req.session.flash = { type: 'success', message: `Order #${order.id} synced.` };
  } catch (err) {
    req.session.flash = { type: 'error', message: `Sync failed: ${err.message}` };
  }
  res.redirect('/admin/orders');
});

router.post('/orders/:id/set-status', (req, res) => {
  const order = ordersModel.findById(req.params.id);
  const newStatus = req.body.status;
  if (!order) {
    req.session.flash = { type: 'error', message: 'Order not found.' };
    return res.redirect('/admin/orders');
  }
  const refundableStates = ['canceled', 'failed'];
  const alreadyRefunded = refundableStates.includes(order.status);

  ordersModel.setStatus(order.id, newStatus, req.body.note || null);

  if (refundableStates.includes(newStatus) && !alreadyRefunded) {
    usersModel.adjustBalance(order.user_id, order.charge, 'refund', `Refund: order #${order.id} marked ${newStatus} by admin`);
  }

  req.session.flash = { type: 'success', message: `Order #${order.id} set to "${newStatus}".` };
  res.redirect('/admin/orders');
});

// ---------- Fund requests ----------
router.get('/fund-requests', (req, res) => {
  const fundRequests = fundRequestsModel.listAll();
  res.render('admin/fund-requests', { title: 'Admin · Fund requests', active: 'fund-requests', fundRequests });
});

router.post('/fund-requests/:id/approve', (req, res) => {
  const fr = fundRequestsModel.findById(req.params.id);
  if (!fr || fr.status !== 'pending') {
    req.session.flash = { type: 'error', message: 'Request not found or already reviewed.' };
    return res.redirect('/admin/fund-requests');
  }
  usersModel.adjustBalance(fr.user_id, fr.amount, 'deposit', `Top-up approved (request #${fr.id})`);
  fundRequestsModel.review(fr.id, { status: 'approved', adminNote: req.body.note });
  req.session.flash = { type: 'success', message: `Request #${fr.id} approved and wallet credited.` };
  res.redirect('/admin/fund-requests');
});

router.post('/fund-requests/:id/reject', (req, res) => {
  const fr = fundRequestsModel.findById(req.params.id);
  if (!fr || fr.status !== 'pending') {
    req.session.flash = { type: 'error', message: 'Request not found or already reviewed.' };
    return res.redirect('/admin/fund-requests');
  }
  fundRequestsModel.review(fr.id, { status: 'rejected', adminNote: req.body.note });
  req.session.flash = { type: 'success', message: `Request #${fr.id} rejected.` };
  res.redirect('/admin/fund-requests');
});

// ---------- Settings ----------
router.get('/settings', (req, res) => {
  res.render('admin/settings', { title: 'Admin · Settings', active: 'settings', settings: settingsModel.getAll() });
});

router.post('/settings', (req, res) => {
  settingsModel.setMany({
    app_name: req.body.app_name,
    currency_symbol: req.body.currency_symbol,
    support_email: req.body.support_email,
    default_markup: req.body.default_markup,
    min_deposit: req.body.min_deposit,
    provider_api_url: req.body.provider_api_url,
    provider_api_key: req.body.provider_api_key,
  });
  req.session.flash = { type: 'success', message: 'Settings saved.' };
  res.redirect('/admin/settings');
});

module.exports = router;
