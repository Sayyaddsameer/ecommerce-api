const express = require('express');
const pricingController = require('../controllers/pricingController');

const router = express.Router();

router.get('/', pricingController.listRules);
router.post('/', pricingController.createRule);

module.exports = router;
