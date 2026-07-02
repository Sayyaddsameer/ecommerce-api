const cartService = require('../services/cartService');

async function create(req, res, next) {
  try {
    const cart = await cartService.createCart(req.body);
    res.status(201).json(cart);
  } catch (err) {
    next(err);
  }
}

async function getOne(req, res, next) {
  try {
    const cart = await cartService.getCartWithItems(req.params.id);
    res.status(200).json(cart);
  } catch (err) {
    next(err);
  }
}

async function addItem(req, res, next) {
  try {
    const result = await cartService.addItemToCart(req.body);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
}

async function checkout(req, res, next) {
  try {
    const cartId = req.body.cart_id || req.params.id;
    const result = await cartService.checkout(cartId);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

module.exports = { create, getOne, addItem, checkout };
