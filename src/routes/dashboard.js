const express = require('express');
const bcrypt = require('bcryptjs');
const { requireAuth } = require('../middleware/auth');
const servicesModel = require('../models/services');
const ordersModel = require('../models/orders');
const usersModel = require('../models/users');
const transactionsModel = require('../models/transactions');
const fundRequestsModel = require('../models/fundRequests');
const settingsModel = require('../models/settings');
const providerApi = require('../services/providerApi');
const db = require('../config/db');

const router = express.Router();
router.use(requireAuth);

function calcCharge(service, quantity) {
  const raw = (service.rate_per_1000 / 1000) * quantity;
  return Math.round(raw * 100) / 100;
}

router.get('/', async (req, res) => {
  const allOrders = await ordersModel.listForUser(req.session.userId);
  const orders = allOrders.slice(0, 5);
  const transactions = await transactionsModel.listForUser(req.session.userId, 5);
  res.render('dashboard/overview', {
    title: 'Dashboard',
    active: 'overview',
    orders,
    transactions,
  });
});

router.get('/order/new', async (req, res) => {
  const services = await servicesModel.listActiveWithCategory();
  // Group active services by category_name for the dropdown
  const grouped = {};
  for (const s of services) {
    const cat = s.category_name || 'Other';
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(s);
  }
  const preselect = req.query.service ? parseInt(req.query.service, 10) : null;
  res.render('dashboard/new-order', {
    title: 'New Order',
    active: 'new-order',
    grouped,
    preselect,
    errors: [],
  });
});

router.post('/order/new', async (req, res) => {
  const serviceId = parseInt(req.body.service_id, 10);
  const link = (req.body.link || '').trim();
  const quantity = parseInt(req.body.quantity, 10);

  const services = await servicesModel.listActiveWithCategory();
  const grouped = {};
  for (const s of services) {
    const cat = s.category_name || 'Other';
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(s);
  }

  const renderError = (msg) =>
    res.status(400).render('dashboard/new-order', {
      title: 'New Order',
      active: 'new-order',
      grouped,
      preselect: serviceId,
      errors: [{ msg }],
    });

  const service = await servicesModel.findById(serviceId);
  if (!service || service.status !== 'active') {
    return renderError('Please choose a valid active service.');
  }
  if (!link || !/^https?:\/\/.+/i.test(link)) {
    return renderError('Please enter a valid link starting with http:// or https://.');
  }
  if (!quantity || quantity < service.min_quantity || quantity > service.max_quantity) {
    return renderError(
      `Quantity must be between ${service.min_quantity} and ${service.max_quantity}.`
    );
  }

  const charge = calcCharge(service, quantity);if (!charge || charge <= 0) {
  return renderError('Order charge is too low for this quantity.');
  } 
  const user = await usersModel.findById(req.session.userId);
  if (!user || user.wallet_balance < charge) {
    return renderError(
      `Insufficient wallet balance. This order costs ${res.locals.site.currency}${charge.toFixed(2)}.`
    );
  }

  // Debit wallet first, then try to place with the provider. If the
  // provider call fails, refund immediately so the customer is never
  // left charged with nothing happening.
  try {
    await usersModel.adjustBalance(
      user.id,
      -charge,
      'order',
      `Order: ${service.name} (${quantity})`
    );
  } catch (err) {
    return renderError(err.message);
  }

  const order = await ordersModel.create({
    userId: user.id,
    serviceId: service.id,
    link,
    quantity,
    charge,
  });

  if (providerApi.isConfigured() && service.provider_service_id) {
    try {
      const providerOrderId = await providerApi.createOrder({
        service: service.provider_service_id,
        link,
        quantity,
      });
      if (!providerOrderId) {
  throw new Error('Provider did not return an order ID.');
}
      await ordersModel.setProviderOrderId(order.id, providerOrderId, 'processing');
    } catch (err) {
      await usersModel.adjustBalance(
        user.id,
        charge,
        'refund',
        `Refund: order #${order.id} failed`
      );
      await ordersModel.setStatus(order.id, 'failed', `Provider error: ${err.message}`);
    }
  }

  req.session.flash = {
    type: 'success',
    message: `Order #${order.id} placed! Check "My orders" for updates.`,
  };
  res.redirect('/dashboard/orders');
});

router.get('/orders', async (req, res) => {
  const orders = await ordersModel.listForUser(req.session.userId);
  res.render('dashboard/orders', { title: 'My orders', active: 'orders', orders });
});

router.post('/orders/:id/refresh', async (req, res) => {
  const order = await ordersModel.findById(req.params.id);
  if (!order || order.user_id !== req.session.userId) {
    req.session.flash = { type: 'error', message: 'Order not found.' };
    return res.redirect('/dashboard/orders');
  }
  if (!order.provider_order_id) {
    req.session.flash = { type: 'error', message: 'This order has no provider reference yet.' };
    return res.redirect('/dashboard/orders');
  }
  try {
    const status = await providerApi.getOrderStatus(order.provider_order_id);
    await ordersModel.updateStatusFields(order.id, {
      status: status.status ? status.status.toLowerCase() : undefined,
      start_count: status.start_count,
      remains: status.remains,
    });
    req.session.flash = { type: 'success', message: `Order #${order.id} status refreshed.` };
  } catch (err) {
    req.session.flash = { type: 'error', message: `Could not refresh status: ${err.message}` };
  }
  res.redirect('/dashboard/orders');
});

router.get('/wallet', async (req, res) => {
  const transactions = await transactionsModel.listForUser(req.session.userId);
  const fundRequests = await fundRequestsModel.listForUser(req.session.userId);
  const minDeposit = parseFloat(await settingsModel.get('min_deposit', '100')) || 100;
  res.render('dashboard/wallet', {
    title: 'Wallet',
    active: 'wallet',
    transactions,
    fundRequests,
    minDeposit,
    errors: [],
  });
});

router.post('/wallet/fund-request', async (req, res) => {
  const amount = parseFloat(req.body.amount);
  const method = (req.body.method || 'bank_transfer').trim();
  const reference = (req.body.reference || '').trim();
  const minDeposit = parseFloat(await settingsModel.get('min_deposit', '100')) || 100;

  if (!amount || amount < minDeposit) {
    req.session.flash = {
      type: 'error',
      message: `Minimum top-up amount is ${res.locals.site.currency}${minDeposit}.`,
    };
    return res.redirect('/dashboard/wallet');
  }

  await fundRequestsModel.create({
    userId: req.session.userId,
    amount,
    method,
    reference,
  });
  req.session.flash = {
    type: 'success',
    message: 'Top-up request submitted. Our team will verify and credit your wallet shortly.',
  };
  res.redirect('/dashboard/wallet');
});

router.get('/profile', (req, res) => {
  res.render('dashboard/profile', { title: 'Profile', active: 'profile', errors: [] });
});

router.post('/profile/password', async (req, res) => {
  const { currentPassword, newPassword, confirmPassword } = req.body;
  const user = await usersModel.findById(req.session.userId);

  if (!user || !bcrypt.compareSync(currentPassword || '', user.password_hash)) {
    return res.status(400).render('dashboard/profile', {
      title: 'Profile',
      active: 'profile',
      errors: [{ msg: 'Current password is incorrect.' }],
    });
  }

  if (!newPassword || newPassword.length < 8 || newPassword !== confirmPassword) {
    return res.status(400).render('dashboard/profile', {
      title: 'Profile',
      active: 'profile',
      errors: [{ msg: 'New password must be at least 8 characters and match the confirmation.' }],
    });
  }

  await db.query('UPDATE users SET password_hash = $1 WHERE id = $2', [
    bcrypt.hashSync(newPassword, 10),
    req.session.userId,
  ]);

  req.session.flash = { type: 'success', message: 'Password updated successfully.' };
  res.redirect('/dashboard/profile');
});

module.exports = router;