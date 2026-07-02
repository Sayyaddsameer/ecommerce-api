// Dynamic pricing engine.
//
// Implements a pipeline (chain-of-responsibility) architecture: the base
// price is computed once, then every active pricing rule is loaded ordered
// by priority (ascending -- lower priority number runs first) and each rule
// decides for itself, via a small strategy object, whether it applies and
// how much it shaves off the running price. All math happens in integer
// cents to avoid floating-point rounding errors.

const db = require('../db');
const { NotFoundError, ValidationError } = require('../utils/errors');
const { toCents, centsToDecimalString } = require('../utils/money');
const productService = require('./productService');
const variantService = require('./variantService');

// --- Strategy Pattern: one strategy per rule_type -------------------------
//
// Each strategy receives the rule row plus the pricing context and returns
// either `null` (rule does not apply) or the discount in integer cents to
// subtract from the current running price.

const RULE_STRATEGIES = {
  USER_TIER: (rule, ctx) => {
    const requiredTier = rule.condition_payload?.tier;
    if (!requiredTier) return null;
    if (!ctx.userTier || ctx.userTier.toLowerCase() !== String(requiredTier).toLowerCase()) {
      return null;
    }
    return computeDiscountCents(rule, ctx.runningPriceCents);
  },

  BULK: (rule, ctx) => {
    const minQuantity = Number(rule.condition_payload?.min_quantity ?? 0);
    if (ctx.quantity < minQuantity) return null;
    return computeDiscountCents(rule, ctx.runningPriceCents);
  },

  PROMO_CODE: (rule, ctx) => {
    const requiredCode = rule.condition_payload?.code;
    if (!requiredCode) return null;
    if (!ctx.promoCode || ctx.promoCode.toUpperCase() !== String(requiredCode).toUpperCase()) {
      return null;
    }
    return computeDiscountCents(rule, ctx.runningPriceCents);
  },

  SEASONAL: (rule, ctx) => {
    // Seasonal rules are date-gated only (starts_at/ends_at, checked in the
    // SQL query below), so if we reach here the rule is already "in season".
    return computeDiscountCents(rule, ctx.runningPriceCents);
  },
};

function computeDiscountCents(rule, runningPriceCents) {
  const value = Number(rule.discount_value);
  if (rule.discount_type === 'PERCENTAGE') {
    return Math.round((runningPriceCents * value) / 100);
  }
  // FIXED discount value is stored as a decimal currency amount.
  return toCents(value);
}

async function getActivePricingRulesSortedByPriority() {
  const now = new Date();
  return db('pricing_rules')
    .where({ is_active: true })
    .andWhere((builder) => {
      builder.whereNull('starts_at').orWhere('starts_at', '<=', now);
    })
    .andWhere((builder) => {
      builder.whereNull('ends_at').orWhere('ends_at', '>=', now);
    })
    .orderBy('priority', 'asc')
    .orderBy('id', 'asc');
}

async function getBaseAndVariantPrice(variantId) {
  const variant = await variantService.getVariantById(variantId);
  const product = await productService.getProductById(variant.product_id);
  const baseCents = toCents(product.base_price);
  const adjustmentCents = toCents(variant.price_adjustment);
  return { product, variant, unitPriceCents: baseCents + adjustmentCents };
}

async function calculatePrice({ productId, variantId, quantity, userTier, promoCode }) {
  const qty = Number(quantity);
  if (!Number.isInteger(qty) || qty <= 0) {
    throw new ValidationError('quantity must be a positive integer');
  }

  const { product, variant, unitPriceCents } = await getBaseAndVariantPrice(variantId);
  if (productId && Number(product.id) !== Number(productId)) {
    throw new ValidationError(
      `variant ${variantId} does not belong to product ${productId}`
    );
  }

  let runningPriceCents = unitPriceCents;
  const breakdown = [];

  const activeRules = await getActivePricingRulesSortedByPriority();

  for (const rule of activeRules) {
    const strategy = RULE_STRATEGIES[rule.rule_type];
    if (!strategy) continue;

    const discountCents = strategy(rule, {
      quantity: qty,
      userTier,
      promoCode,
      runningPriceCents,
    });

    if (discountCents === null || discountCents === undefined || discountCents <= 0) {
      continue;
    }

    // Never let a rule (or stack of rules) push the price below zero.
    const appliedDiscountCents = Math.min(discountCents, runningPriceCents);
    runningPriceCents -= appliedDiscountCents;

    breakdown.push({
      rule_id: rule.id,
      rule_name: rule.name,
      rule_type: rule.rule_type,
      discount_type: rule.discount_type,
      discount_amount: centsToDecimalString(appliedDiscountCents),
    });
  }

  const unitFinalPriceCents = runningPriceCents;

  return {
    product_id: product.id,
    variant_id: variant.id,
    quantity: qty,
    unit_base_price: centsToDecimalString(unitPriceCents),
    unit_final_price: centsToDecimalString(unitFinalPriceCents),
    final_price: centsToDecimalString(unitFinalPriceCents * qty),
    applied_discounts: breakdown,
  };
}

module.exports = {
  calculatePrice,
  getActivePricingRulesSortedByPriority,
  getBaseAndVariantPrice,
};
