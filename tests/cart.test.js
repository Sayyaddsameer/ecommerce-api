const request = require('supertest');
const createApp = require('../src/app');
const { resetDb, createProductWithVariant, db } = require('./helpers');

const app = createApp();

describe('Cart reservation & checkout', () => {
  beforeEach(async () => {
    await resetDb();
  });

  test('adding an item reserves inventory and snapshots price', async () => {
    const { variant } = await createProductWithVariant({ basePrice: '30.00', stock: 10 });

    const res = await request(app)
      .post('/cart/items')
      .send({ variant_id: variant.id, quantity: 3 });

    expect(res.status).toBe(201);
    expect(res.body.cart_item.quantity).toBe(3);
    expect(res.body.cart_item.snapshotted_price).toBe('30.00');

    const inventory = await db('inventory').where({ variant_id: variant.id }).first();
    expect(inventory.reserved_quantity).toBe(3);
  });

  test('rejects when requested quantity exceeds available inventory', async () => {
    const { variant } = await createProductWithVariant({ basePrice: '30.00', stock: 2 });

    const res = await request(app)
      .post('/cart/items')
      .send({ variant_id: variant.id, quantity: 5 });

    expect(res.status).toBe(409);

    const inventory = await db('inventory').where({ variant_id: variant.id }).first();
    expect(inventory.reserved_quantity).toBe(0);
  });

  test('cart price stays snapshotted after base price changes', async () => {
    const { product, variant } = await createProductWithVariant({ basePrice: '30.00', stock: 10 });

    const addRes = await request(app)
      .post('/cart/items')
      .send({ variant_id: variant.id, quantity: 1 });
    const cartId = addRes.body.cart.id;

    await db('products').where({ id: product.id }).update({ base_price: '999.00' });

    const getRes = await request(app).get(`/cart/${cartId}`);
    expect(getRes.body.items[0].snapshotted_price).toBe('30.00');
  });

  test('checkout permanently deducts stock and clears reservation', async () => {
    const { variant } = await createProductWithVariant({ basePrice: '10.00', stock: 10 });

    const addRes = await request(app)
      .post('/cart/items')
      .send({ variant_id: variant.id, quantity: 4 });
    const cartId = addRes.body.cart.id;

    const checkoutRes = await request(app).post('/cart/checkout').send({ cart_id: cartId });
    expect(checkoutRes.status).toBe(200);
    expect(checkoutRes.body.order_total).toBe('40.00');

    const inventory = await db('inventory').where({ variant_id: variant.id }).first();
    expect(inventory.stock_quantity).toBe(6);
    expect(inventory.reserved_quantity).toBe(0);

    const items = await db('cart_items').where({ cart_id: cartId });
    expect(items).toHaveLength(0);
  });

  test('checkout rejects an empty cart', async () => {
    const cartRes = await request(app).post('/cart').send({});
    const checkoutRes = await request(app)
      .post('/cart/checkout')
      .send({ cart_id: cartRes.body.id });
    expect(checkoutRes.status).toBe(400);
  });
});
