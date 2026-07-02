const db = require('../db');
const { NotFoundError, ValidationError } = require('../utils/errors');
const productService = require('./productService');

async function createVariant(productId, { sku, name_modifier, price_adjustment, initial_stock }) {
  await productService.getProductById(productId);

  if (!sku || !sku.trim()) throw new ValidationError('sku is required');

  const existing = await db('variants').where({ sku }).first();
  if (existing) throw new ValidationError(`sku "${sku}" is already in use`);

  return db.transaction(async (trx) => {
    const [variant] = await trx('variants')
      .insert({
        product_id: productId,
        sku,
        name_modifier: name_modifier || null,
        price_adjustment: price_adjustment || 0,
      })
      .returning('*');

    // Every variant must have a corresponding inventory row, initialized
    // with zero reserved quantity, per the task spec.
    await trx('inventory').insert({
      variant_id: variant.id,
      stock_quantity: initial_stock || 0,
      reserved_quantity: 0,
    });

    return variant;
  });
}

async function listVariantsForProduct(productId) {
  await productService.getProductById(productId);
  return db('variants')
    .leftJoin('inventory', 'inventory.variant_id', 'variants.id')
    .where('variants.product_id', productId)
    .select(
      'variants.*',
      'inventory.stock_quantity',
      'inventory.reserved_quantity',
      db.raw('(inventory.stock_quantity - inventory.reserved_quantity) as available_quantity')
    );
}

async function getVariantById(id) {
  const variant = await db('variants').where({ id }).first();
  if (!variant) throw new NotFoundError(`Variant ${id} not found`);
  return variant;
}

module.exports = { createVariant, listVariantsForProduct, getVariantById };
