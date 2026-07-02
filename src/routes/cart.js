const express = require('express');
const cartController = require('../controllers/cartController');

const router = express.Router();

router.post('/', cartController.create);
router.get('/:id', cartController.getOne);
router.post('/items', cartController.addItem);
router.post('/checkout', cartController.checkout);
router.post('/:id/checkout', cartController.checkout);

module.exports = router;
