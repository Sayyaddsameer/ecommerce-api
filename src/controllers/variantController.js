const variantService = require('../services/variantService');

async function create(req, res, next) {
  try {
    const variant = await variantService.createVariant(req.params.id, req.body);
    res.status(201).json(variant);
  } catch (err) {
    next(err);
  }
}

async function list(req, res, next) {
  try {
    const variants = await variantService.listVariantsForProduct(req.params.id);
    res.status(200).json(variants);
  } catch (err) {
    next(err);
  }
}

module.exports = { create, list };
