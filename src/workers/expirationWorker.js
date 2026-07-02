// Reservation-expiration sweep.
//
// Runs independently of the HTTP request cycle (triggered by a BullMQ
// repeatable job, see queue.js). Finds cart_items whose reservation has
// expired, releases the corresponding `reserved_quantity` back into the
// available pool, and removes the cart item.
//
// Idempotency: everything happens inside a single DB transaction that
// SELECTs the expired rows with `FOR UPDATE SKIP LOCKED` and then deletes
// them in the same transaction as the inventory decrement. If the process
// crashes mid-sweep, the transaction rolls back entirely -- nothing is
// left half-applied -- so a rerun simply picks the same rows up again.
// `SKIP LOCKED` also means two overlapping sweeps never double-process the
// same row.

const db = require('../db');

async function releaseExpiredReservations() {
  return db.transaction(async (trx) => {
    const expiredItems = await trx('cart_items')
      .where('reservation_expires_at', '<', trx.fn.now())
      .forUpdate()
      .skipLocked();

    if (expiredItems.length === 0) {
      return { released: 0 };
    }

    // Aggregate quantity-to-release per variant so we issue one UPDATE per
    // variant rather than N updates, and lock inventory rows in a
    // deterministic order (ascending variant_id) to avoid deadlocks with
    // the cart/checkout code paths, which also lock inventory rows.
    const releaseByVariant = new Map();
    for (const item of expiredItems) {
      releaseByVariant.set(
        item.variant_id,
        (releaseByVariant.get(item.variant_id) || 0) + item.quantity
      );
    }
    const orderedVariantIds = [...releaseByVariant.keys()].sort((a, b) => a - b);

    for (const variantId of orderedVariantIds) {
      const qtyToRelease = releaseByVariant.get(variantId);
      const inventoryRow = await trx('inventory')
        .where({ variant_id: variantId })
        .forUpdate()
        .first();

      if (!inventoryRow) continue;

      const newReserved = Math.max(0, inventoryRow.reserved_quantity - qtyToRelease);
      await trx('inventory')
        .where({ variant_id: variantId })
        .update({
          reserved_quantity: newReserved,
          version: inventoryRow.version + 1,
          updated_at: trx.fn.now(),
        });
    }

    const expiredIds = expiredItems.map((i) => i.id);
    await trx('cart_items').whereIn('id', expiredIds).del();

    return { released: expiredItems.length, variants_affected: orderedVariantIds.length };
  });
}

module.exports = { releaseExpiredReservations };
