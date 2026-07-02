const express = require('express');
const categoryController = require('../controllers/categoryController');

const router = express.Router();

router.get('/', categoryController.list);
router.post('/', categoryController.create);
router.get('/:id', categoryController.getOne);

module.exports = router;
