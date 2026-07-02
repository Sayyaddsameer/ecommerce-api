// Cart & checkout service.
//
// This is the most concurrency-sensitive part of the system. Two shoppers
// can race to reserve the last unit of a variant, and we must never let
// both succeed (overselling). We solve this with PESSIMISTIC LOCKING:
// `SELECT ... FOR UPDATE` on the `inventory` row inside a DB transaction.
// The row lock forces the second concurrent transaction to block until the
// first commits or rolls back, so it always sees the up-to-date reserved
// quantity rather than a stale read.

const db = require('../db');
const config = require('../config');
const { NotFoundError, ValidationError, ConflictError } = require('../utils/errors');
const pricingService = require('./pricingService');

async function createCart({ user_id } = {}) {
  const [cart] = await db('carts').insert({ user_id: user_id || null }).returning('*');
  return cart;
}

async function getCartById(cartId) {
  const cart = await db('carts').where({ id: cartId }).first();
  if (!cart) throw new NotFoundError(`Cart ${cartId} not found`);
  return cart;
}

async function getCartWithItems(cartId) {
  const cart = await getCartById(cartId);
  const items = await db('cart_items')
    .join('variants', 'variants.id', 'cart_items.variant_id')
    .where('cart_items.cart_id', cartId)
    .select(
      'cart_items.id',
      'cart_items.variant_id',
      'variants.sku',
      'cart_items.quantity',
      'cart_items.snapshotted_price',
      'cart_items.reservation_expires_at',
      db.raw('(cart_items.snapshotted_price * cart_items.quantity) as line_total')
    );
  return { ...cart, items };
}

async function addItemToCart({ cart_id, user_id, variant_id, quantity, user_tier, promo_code }) {
  const qty = Number(quantity);
  if (!variant_id) throw new ValidationError('variant_id is required');
  if (!Number.isInteger(qty) || qty <= 0) {
    throw new ValidationError('quantity must be a positive integer');
  }

  // Compute the price BEFORE opening the transaction -- pricing rules are
  // read-only and don't need to be inside the locked section, keeping the
  // lock's critical section as short as possible.
  const variant = await db('variants').where({ id: variant_id }).first();
  if (!variant) throw new NotFoundError(`Variant ${variant_id} not found`);

  const priceResult = await pricingService.calculatePrice({
    productId: variant.product_id,
    variantId: variant_id,
    quantity: qty,
    userTier: user_tier,
    promoCode: promo_code,
  });
  const unitSnapshotPrice = priceResult.unit_final_price;

  return db.transaction(async (trx) => {
    let cart;
    if (cart_id) {
      cart = await trx('carts').where({ id: cart_id }).first();
      if (!cart) throw new NotFoundError(`Cart ${cart_id} not found`);
    } else {
      [cart] = await trx('carts').insert({ user_id: user_id || null }).returning('*');
    }

    // --- Pessimistic lock: SELECT ... FOR UPDATE -------------------------
    // This blocks any other transaction from reading/writing this same
    // inventory row until we commit or roll back, which is what makes the
    // read-check-write sequence below safe under concurrency.
    const inventoryRow = await trx('inventory')
      .where({ variant_id })
      .forUpdate()
      .first();

    if (!inventoryRow) {
      throw new NotFoundError(`Inventory record for variant ${variant_id} not found`);
    }

    const existingItem = await trx('cart_items')
      .where({ cart_id: cart.id, variant_id })
      .first();
    const alreadyReservedByThisItem = existingItem ? existingItem.quantity : 0;

    const availableQuantity =
      inventoryRow.stock_quantity - inventoryRow.reserved_quantity + alreadyReservedByThisItem;

    if (qty > availableQuantity) {
      throw new ConflictError(
        `Requested quantity (${qty}) exceeds available inventory (${availableQuantity})`,
        {
          variant_id,
          requested_quantity: qty,
          available_quantity: availableQuantity,
        }
      );
    }

    const deltaReserved = qty - alreadyReservedByThisItem;

    await trx('inventory')
      .where({ variant_id })
      .update({
        reserved_quantity: inventoryRow.reserved_quantity + deltaReserved,
        version: inventoryRow.version + 1,
        updated_at: trx.fn.now(),
      });

    const expiresAt = new Date(
      Date.now() + config.reservationTtlMinutes * 60 * 1000
    );

    let cartItem;
    if (existingItem) {
      [cartItem] = await trx('cart_items')
        .where({ id: existingItem.id })
        .update({
          quantity: qty,
          snapshotted_price: unitSnapshotPrice,
          reservation_expires_at: expiresAt,
          updated_at: trx.fn.now(),
        })
        .returning('*');
    } else {
      [cartItem] = await trx('cart_items')
        .insert({
          cart_id: cart.id,
          variant_id,
          quantity: qty,
          snapshotted_price: unitSnapshotPrice,
          reservation_expires_at: expiresAt,
        })
        .returning('*');
    }

    return { cart, cart_item: cartItem, price_breakdown: priceResult.applied_discounts };
  });
}

async function checkout(cartId) {
  return db.transaction(async (trx) => {
    const cart = await trx('carts').where({ id: cartId }).first();
    if (!cart) throw new NotFoundError(`Cart ${cartId} not found`);
    if (cart.status !== 'active') {
      throw new ConflictError(`Cart ${cartId} is not active (status: ${cart.status})`);
    }

    const items = await trx('cart_items').where({ cart_id: cartId });
    if (items.length === 0) {
      throw new ValidationError('Cart is empty');
    }

    const now = new Date();
    const expired = items.filter((item) => new Date(item.reservation_expires_at) < now);
    if (expired.length > 0) {
      throw new ConflictError('One or more cart items have expired reservations', {
        expired_variant_ids: expired.map((i) => i.variant_id),
      });
    }

    let orderTotalCents = 0;
    const { toCents } = require('../utils/money');

    for (const item of items) {
      // Lock the inventory row before permanently deducting stock.
      const inventoryRow = await trx('inventory')
        .where({ variant_id: item.variant_id })
        .forUpdate()
        .first();

      if (!inventoryRow || inventoryRow.reserved_quantity < item.quantity) {
        throw new ConflictError(
          `Inventory inconsistency detected for variant ${item.variant_id}`
        );
      }

      await trx('inventory')
        .where({ variant_id: item.variant_id })
        .update({
          stock_quantity: inventoryRow.stock_quantity - item.quantity,
          reserved_quantity: inventoryRow.reserved_quantity - item.quantity,
          version: inventoryRow.version + 1,
          updated_at: trx.fn.now(),
        });

      orderTotalCents += toCents(item.snapshotted_price) * item.quantity;
    }

    await trx('cart_items').where({ cart_id: cartId }).del();
    await trx('carts').where({ id: cartId }).update({
      status: 'checked_out',
      updated_at: trx.fn.now(),
    });

    const { centsToDecimalString } = require('../utils/money');
    return {
      cart_id: cartId,
      status: 'checked_out',
      items_purchased: items.map((i) => ({
        variant_id: i.variant_id,
        quantity: i.quantity,
        unit_price: i.snapshotted_price,
      })),
      order_total: centsToDecimalString(orderTotalCents),
    };
  });
}

module.exports = { createCart, getCartById, getCartWithItems, addItemToCart, checkout };
