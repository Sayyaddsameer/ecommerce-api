const pricingService = require('../services/pricingService');
const pricingRuleService = require('../services/pricingRuleService');

async function getPrice(req, res, next) {
  try {
    const { id: productId } = req.params;
    const { variant_id, quantity, user_tier, promo_code } = req.query;

    if (!variant_id) {
      return res.status(400).json({ error: 'variant_id query parameter is required' });
    }

    const result = await pricingService.calculatePrice({
      productId,
      variantId: variant_id,
      quantity: quantity || 1,
      userTier: user_tier,
      promoCode: promo_code,
    });
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

async function createRule(req, res, next) {
  try {
    const rule = await pricingRuleService.createPricingRule(req.body);
    res.status(201).json(rule);
  } catch (err) {
    next(err);
  }
}

async function listRules(req, res, next) {
  try {
    const rules = await pricingRuleService.listPricingRules();
    res.status(200).json(rules);
  } catch (err) {
    next(err);
  }
}

module.exports = { getPrice, createRule, listRules };
