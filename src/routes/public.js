const express = require('express');
const servicesModel = require('../models/services');
const ordersModel = require('../models/orders');
const usersModel = require('../models/users');

const router = express.Router();

router.get('/', async (req, res) => {
  const services = await servicesModel.listActiveWithCategory();
  const grouped = {};
  for (const s of services) {
    const cat = s.category_name || 'Other';
    grouped[cat] = grouped[cat] || [];
    grouped[cat].push(s);
  }

  const statusCounts = await ordersModel.countByStatus();
  const completedRow = statusCounts.find((r) => r.status === 'completed');

  const stats = {
    users: await usersModel.countAll(),
    completedOrders: completedRow ? completedRow.n : 0,
  };

  res.render('public/home', { title: 'Instagram Growth Services', grouped, stats });
});

router.get('/faq', (req, res) => res.render('public/faq', { title: 'FAQ' }));
router.get('/contact', (req, res) => res.render('public/contact', { title: 'Contact' }));
router.get('/terms', (req, res) => res.render('public/terms', { title: 'Terms of Service' }));
router.get('/privacy', (req, res) => res.render('public/privacy', { title: 'Privacy Policy' }));
router.get('/refund-policy', (req, res) => res.render('public/refund', { title: 'Refund Policy' }));

module.exports = router;