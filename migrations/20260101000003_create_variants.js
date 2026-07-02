exports.up = function (knex) {
  return knex.schema.createTable('variants', (table) => {
    table.increments('id').primary();
    table
      .integer('product_id')
      .unsigned()
      .notNullable()
      .references('id')
      .inTable('products')
      .onDelete('CASCADE');
    table.string('sku', 100).notNullable().unique();
    // e.g. "XXL / Blue"
    table.string('name_modifier', 255);
    // e.g. +5.00 for an XXL upcharge, can be negative
    table.decimal('price_adjustment', 10, 2).notNullable().defaultTo(0);
    table.boolean('is_active').notNullable().defaultTo(true);
    table.timestamps(true, true);

    table.index('product_id');
  });
};

exports.down = function (knex) {
  return knex.schema.dropTableIfExists('variants');
};
