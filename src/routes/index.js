const express = require('express');
const categories = require('./categories');
const products = require('./products');
const cart = require('./cart');
const pricingRules = require('./pricingRules');

const router = express.Router();

router.get('/health', (req, res) => res.status(200).json({ status: 'ok' }));

router.use('/categories', categories);
router.use('/products', products);
router.use('/cart', cart);
router.use('/pricing-rules', pricingRules);

module.exports = router;
