exports.seed = async function (knex) {
  await knex('cart_items').del();
  await knex('carts').del();
  await knex('pricing_rules').del();
  await knex('inventory').del();
  await knex('variants').del();
  await knex('products').del();
  await knex('categories').del();

  const [apparel] = await knex('categories')
    .insert({ name: 'Apparel', description: 'Clothing and accessories' })
    .returning('*');
  await knex('categories').insert({
    name: 'T-Shirts',
    description: 'All t-shirts',
    parent_id: apparel.id,
  });

  const [product] = await knex('products')
    .insert({
      name: 'Classic Crew T-Shirt',
      description: 'A 100% cotton crew neck t-shirt',
      base_price: 20.0,
      category_id: apparel.id,
      status: 'active',
    })
    .returning('*');

  const [variantM] = await knex('variants')
    .insert({
      product_id: product.id,
      sku: 'TSHIRT-M-BLK',
      name_modifier: 'Medium / Black',
      price_adjustment: 0,
    })
    .returning('*');

  const [variantXXL] = await knex('variants')
    .insert({
      product_id: product.id,
      sku: 'TSHIRT-XXL-BLK',
      name_modifier: 'XXL / Black',
      price_adjustment: 5.0,
    })
    .returning('*');

  await knex('inventory').insert([
    { variant_id: variantM.id, stock_quantity: 50, reserved_quantity: 0 },
    { variant_id: variantXXL.id, stock_quantity: 5, reserved_quantity: 0 },
  ]);

  await knex('pricing_rules').insert([
    {
      name: 'Gold Tier 15% Off',
      rule_type: 'USER_TIER',
      priority: 10,
      discount_type: 'PERCENTAGE',
      discount_value: 15.0,
      condition_payload: JSON.stringify({ tier: 'gold' }),
      is_active: true,
    },
    {
      name: 'Buy 5+ Save 10%',
      rule_type: 'BULK',
      priority: 20,
      discount_type: 'PERCENTAGE',
      discount_value: 10.0,
      condition_payload: JSON.stringify({ min_quantity: 5 }),
      is_active: true,
    },
    {
      name: 'SUMMER10 Promo',
      rule_type: 'PROMO_CODE',
      priority: 30,
      discount_type: 'FIXED',
      discount_value: 3.0,
      condition_payload: JSON.stringify({ code: 'SUMMER10' }),
      is_active: true,
    },
  ]);
};
