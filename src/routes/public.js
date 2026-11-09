const express = require('express');
const servicesModel = require('../models/services');
const ordersModel = require('../models/orders');
const usersModel = require('../models/users');

const router = express.Router();

router.get('/', (req, res) => {
  const services = servicesModel.listActiveWithCategory();
  const grouped = {};
  for (const s of services) {
    const cat = s.category_name || 'Other';
    grouped[cat] = grouped[cat] || [];
    grouped[cat].push(s);
  }

  const stats = {
    users: usersModel.countAll(),
    completedOrders: (ordersModel.countByStatus().find((r) => r.status === 'completed') || { n: 0 }).n,
  };

  res.render('public/home', { title: 'Instagram Growth Services', grouped, stats });
});

router.get('/faq', (req, res) => res.render('public/faq', { title: 'FAQ' }));
router.get('/contact', (req, res) => res.render('public/contact', { title: 'Contact' }));
router.get('/terms', (req, res) => res.render('public/terms', { title: 'Terms of Service' }));
router.get('/privacy', (req, res) => res.render('public/privacy', { title: 'Privacy Policy' }));
router.get('/refund-policy', (req, res) => res.render('public/refund', { title: 'Refund Policy' }));

module.exports = router;
