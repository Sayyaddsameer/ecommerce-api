exports.up = function (knex) {
  return knex.schema
    .createTable('cart_items', (table) => {
      table.increments('id').primary();
      table
        .integer('cart_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('carts')
        .onDelete('CASCADE');
      table
        .integer('variant_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('variants')
        .onDelete('CASCADE');
      table.integer('quantity').notNullable();
      // Price locked in at the moment the item was added to the cart, so
      // subsequent base-price or pricing-rule changes never retroactively
      // change what the shopper sees.
      table.decimal('snapshotted_price', 10, 2).notNullable();
      table.timestamp('reservation_expires_at').notNullable();
      table.timestamps(true, true);

      table.unique(['cart_id', 'variant_id']);
      table.index('reservation_expires_at');
    })
    .then(function () {
      return knex.raw(
        'ALTER TABLE cart_items ADD CONSTRAINT cart_items_quantity_positive CHECK (quantity > 0)'
      );
    });
};

exports.down = function (knex) {
  return knex.schema.dropTableIfExists('cart_items');
};
