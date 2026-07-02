exports.up = function (knex) {
  return knex.schema.createTable('products', (table) => {
    table.increments('id').primary();
    table.string('name', 255).notNullable();
    table.text('description');
    // NEVER use floating point for money. NUMERIC(10,2) is exact.
    table.decimal('base_price', 10, 2).notNullable();
    table
      .integer('category_id')
      .unsigned()
      .references('id')
      .inTable('categories')
      .onDelete('SET NULL');
    table.enu('status', ['active', 'inactive', 'archived'], {
      useNative: true,
      enumName: 'product_status',
    }).notNullable().defaultTo('active');
    table.timestamps(true, true);

    table.index('category_id');
    table.index('status');
  });
};

exports.down = function (knex) {
  return knex.schema.dropTableIfExists('products').then(() =>
    knex.raw('DROP TYPE IF EXISTS product_status')
  );
};
