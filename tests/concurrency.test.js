const request = require('supertest');
const createApp = require('../src/app');
const { resetDb, createProductWithVariant, db } = require('./helpers');

const app = createApp();

describe('Concurrency: race condition protection', () => {
  beforeEach(async () => {
    await resetDb();
  });

  test('only one of two simultaneous requests for the last unit succeeds', async () => {
    const { variant } = await createProductWithVariant({ basePrice: '15.00', stock: 1 });

    const [resA, resB] = await Promise.all([
      request(app).post('/cart/items').send({ variant_id: variant.id, quantity: 1 }),
      request(app).post('/cart/items').send({ variant_id: variant.id, quantity: 1 }),
    ]);

    const statuses = [resA.status, resB.status].sort();
    expect(statuses).toEqual([201, 409]);

    const inventory = await db('inventory').where({ variant_id: variant.id }).first();
    // Never oversold: exactly 1 unit reserved, never 2.
    expect(inventory.reserved_quantity).toBe(1);
    expect(inventory.stock_quantity).toBe(1);
  });

  test('10 concurrent requests against 3 units of stock: exactly 3 succeed', async () => {
    const { variant } = await createProductWithVariant({ basePrice: '15.00', stock: 3 });

    const requests = Array.from({ length: 10 }, () =>
      request(app).post('/cart/items').send({ variant_id: variant.id, quantity: 1 })
    );
    const results = await Promise.all(requests);

    const succeeded = results.filter((r) => r.status === 201);
    const rejected = results.filter((r) => r.status === 409);

    expect(succeeded).toHaveLength(3);
    expect(rejected).toHaveLength(7);

    const inventory = await db('inventory').where({ variant_id: variant.id }).first();
    expect(inventory.reserved_quantity).toBe(3);
    expect(inventory.reserved_quantity).toBeLessThanOrEqual(inventory.stock_quantity);
  });
});
