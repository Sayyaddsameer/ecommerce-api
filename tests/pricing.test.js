const request = require('supertest');
const createApp = require('../src/app');
const { resetDb, createProductWithVariant, db } = require('./helpers');

const app = createApp();

describe('Dynamic pricing engine', () => {
  beforeEach(async () => {
    await resetDb();
  });

  test('returns base + variant adjustment price with no rules', async () => {
    const { product, variant } = await createProductWithVariant({
      basePrice: '20.00',
      priceAdjustment: '5.00',
    });

    const res = await request(app)
      .get(`/products/${product.id}/price`)
      .query({ variant_id: variant.id, quantity: 1 });

    expect(res.status).toBe(200);
    expect(res.body.unit_base_price).toBe('25.00');
    expect(res.body.unit_final_price).toBe('25.00');
    expect(res.body.final_price).toBe('25.00');
    expect(res.body.applied_discounts).toEqual([]);
  });

  test('applies USER_TIER, then BULK, then PROMO_CODE in priority order', async () => {
    const { product, variant } = await createProductWithVariant({ basePrice: '100.00' });

    await db('pricing_rules').insert([
      {
        name: 'Gold 10%',
        rule_type: 'USER_TIER',
        priority: 10,
        discount_type: 'PERCENTAGE',
        discount_value: 10,
        condition_payload: JSON.stringify({ tier: 'gold' }),
        is_active: true,
      },
      {
        name: 'Bulk 5+',
        rule_type: 'BULK',
        priority: 20,
        discount_type: 'PERCENTAGE',
        discount_value: 10,
        condition_payload: JSON.stringify({ min_quantity: 5 }),
        is_active: true,
      },
      {
        name: 'PROMO5',
        rule_type: 'PROMO_CODE',
        priority: 30,
        discount_type: 'FIXED',
        discount_value: 2,
        condition_payload: JSON.stringify({ code: 'PROMO5' }),
        is_active: true,
      },
    ]);

    const res = await request(app).get(`/products/${product.id}/price`).query({
      variant_id: variant.id,
      quantity: 5,
      user_tier: 'gold',
      promo_code: 'PROMO5',
    });

    expect(res.status).toBe(200);
    // 100 -> -10% (gold) = 90 -> -10% (bulk) = 81 -> -2 fixed (promo) = 79
    expect(res.body.unit_final_price).toBe('79.00');
    expect(res.body.final_price).toBe('395.00');
    expect(res.body.applied_discounts).toHaveLength(3);
    expect(res.body.applied_discounts.map((d) => d.rule_type)).toEqual([
      'USER_TIER',
      'BULK',
      'PROMO_CODE',
    ]);
  });

  test('inactive rules are not applied', async () => {
    const { product, variant } = await createProductWithVariant({ basePrice: '50.00' });
    await db('pricing_rules').insert({
      name: 'Disabled promo',
      rule_type: 'PROMO_CODE',
      priority: 10,
      discount_type: 'FIXED',
      discount_value: 10,
      condition_payload: JSON.stringify({ code: 'DEAD' }),
      is_active: false,
    });

    const res = await request(app)
      .get(`/products/${product.id}/price`)
      .query({ variant_id: variant.id, quantity: 1, promo_code: 'DEAD' });

    expect(res.body.unit_final_price).toBe('50.00');
    expect(res.body.applied_discounts).toEqual([]);
  });

  test('discount never pushes price below zero', async () => {
    const { product, variant } = await createProductWithVariant({ basePrice: '5.00' });
    await db('pricing_rules').insert({
      name: 'Huge fixed discount',
      rule_type: 'PROMO_CODE',
      priority: 10,
      discount_type: 'FIXED',
      discount_value: 100,
      condition_payload: JSON.stringify({ code: 'HUGE' }),
      is_active: true,
    });

    const res = await request(app)
      .get(`/products/${product.id}/price`)
      .query({ variant_id: variant.id, quantity: 1, promo_code: 'HUGE' });

    expect(res.body.unit_final_price).toBe('0.00');
  });
});
