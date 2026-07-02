const db = require('../db');
const { ValidationError, NotFoundError } = require('../utils/errors');

const VALID_RULE_TYPES = ['USER_TIER', 'BULK', 'PROMO_CODE', 'SEASONAL'];
const VALID_DISCOUNT_TYPES = ['PERCENTAGE', 'FIXED'];

async function createPricingRule(body) {
  const {
    name,
    rule_type,
    priority,
    discount_type,
    discount_value,
    condition_payload,
    is_active,
    starts_at,
    ends_at,
  } = body;

  if (!name || !name.trim()) throw new ValidationError('name is required');
  if (!VALID_RULE_TYPES.includes(rule_type)) {
    throw new ValidationError(`rule_type must be one of ${VALID_RULE_TYPES.join(', ')}`);
  }
  if (discount_type && !VALID_DISCOUNT_TYPES.includes(discount_type)) {
    throw new ValidationError(`discount_type must be one of ${VALID_DISCOUNT_TYPES.join(', ')}`);
  }
  if (discount_value === undefined || isNaN(Number(discount_value))) {
    throw new ValidationError('discount_value is required and must be numeric');
  }

  const [rule] = await db('pricing_rules')
    .insert({
      name,
      rule_type,
      priority: priority ?? 100,
      discount_type: discount_type || 'PERCENTAGE',
      discount_value,
      condition_payload: JSON.stringify(condition_payload || {}),
      is_active: is_active ?? true,
      starts_at: starts_at || null,
      ends_at: ends_at || null,
    })
    .returning('*');
  return rule;
}

async function listPricingRules() {
  return db('pricing_rules').orderBy('priority', 'asc').orderBy('id', 'asc');
}

async function getPricingRuleById(id) {
  const rule = await db('pricing_rules').where({ id }).first();
  if (!rule) throw new NotFoundError(`Pricing rule ${id} not found`);
  return rule;
}

module.exports = { createPricingRule, listPricingRules, getPricingRuleById };
