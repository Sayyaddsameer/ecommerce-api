const db = require('../src/db');

async function resetDb() {
  await db('cart_items').del();
  await db('carts').del();
  await db('pricing_rules').del();
  await db('inventory').del();
  await db('variants').del();
  await db('products').del();
  await db('categories').del();
}

async function createProductWithVariant({
  basePrice = '20.00',
  priceAdjustment = '0.00',
  stock = 10,
  sku,
} = {}) {
  const [product] = await db('products')
    .insert({ name: 'Test Product', base_price: basePrice, status: 'active' })
    .returning('*');
  const [variant] = await db('variants')
    .insert({
      product_id: product.id,
      sku: sku || `SKU-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      price_adjustment: priceAdjustment,
    })
    .returning('*');
  await db('inventory').insert({
    variant_id: variant.id,
    stock_quantity: stock,
    reserved_quantity: 0,
  });
  return { product, variant };
}

module.exports = { resetDb, createProductWithVariant, db };
