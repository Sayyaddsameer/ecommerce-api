const { releaseExpiredReservations } = require('../src/workers/expirationWorker');
const { resetDb, createProductWithVariant, db } = require('./helpers');

describe('Background expiration worker', () => {
  beforeEach(async () => {
    await resetDb();
  });

  test('releases reserved quantity for expired cart items and removes them', async () => {
    const { variant } = await createProductWithVariant({ basePrice: '10.00', stock: 5 });
    await db('inventory').where({ variant_id: variant.id }).update({ reserved_quantity: 2 });

    const [cart] = await db('carts').insert({}).returning('*');
    await db('cart_items').insert({
      cart_id: cart.id,
      variant_id: variant.id,
      quantity: 2,
      snapshotted_price: '10.00',
      reservation_expires_at: new Date(Date.now() - 60 * 1000), // already expired
    });

    const result = await releaseExpiredReservations();
    expect(result.released).toBe(1);

    const inventory = await db('inventory').where({ variant_id: variant.id }).first();
    expect(inventory.reserved_quantity).toBe(0);

    const remainingItems = await db('cart_items').where({ cart_id: cart.id });
    expect(remainingItems).toHaveLength(0);
  });

  test('is idempotent: running twice does not double-release', async () => {
    const { variant } = await createProductWithVariant({ basePrice: '10.00', stock: 5 });
    await db('inventory').where({ variant_id: variant.id }).update({ reserved_quantity: 1 });

    const [cart] = await db('carts').insert({}).returning('*');
    await db('cart_items').insert({
      cart_id: cart.id,
      variant_id: variant.id,
      quantity: 1,
      snapshotted_price: '10.00',
      reservation_expires_at: new Date(Date.now() - 60 * 1000),
    });

    await releaseExpiredReservations();
    const secondRun = await releaseExpiredReservations();

    expect(secondRun.released).toBe(0);
    const inventory = await db('inventory').where({ variant_id: variant.id }).first();
    expect(inventory.reserved_quantity).toBe(0); // not negative, not double-released
  });

  test('does not touch reservations that have not expired yet', async () => {
    const { variant } = await createProductWithVariant({ basePrice: '10.00', stock: 5 });
    await db('inventory').where({ variant_id: variant.id }).update({ reserved_quantity: 1 });

    const [cart] = await db('carts').insert({}).returning('*');
    await db('cart_items').insert({
      cart_id: cart.id,
      variant_id: variant.id,
      quantity: 1,
      snapshotted_price: '10.00',
      reservation_expires_at: new Date(Date.now() + 15 * 60 * 1000), // still valid
    });

    const result = await releaseExpiredReservations();
    expect(result.released).toBe(0);

    const inventory = await db('inventory').where({ variant_id: variant.id }).first();
    expect(inventory.reserved_quantity).toBe(1);
  });
});
