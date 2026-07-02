const express = require('express');
const productController = require('../controllers/productController');
const variantController = require('../controllers/variantController');
const pricingController = require('../controllers/pricingController');

const router = express.Router();

router.get('/', productController.list);
router.post('/', productController.create);
router.get('/:id', productController.getOne);
router.put('/:id', productController.update);
router.patch('/:id', productController.update);
router.delete('/:id', productController.remove);

router.post('/:id/variants', variantController.create);
router.get('/:id/variants', variantController.list);

router.get('/:id/price', pricingController.getPrice);

module.exports = router;
