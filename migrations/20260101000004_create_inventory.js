exports.up = function (knex) {
  return knex.schema
    .createTable('inventory', (table) => {
      table
        .integer('variant_id')
        .unsigned()
        .primary()
        .references('id')
        .inTable('variants')
        .onDelete('CASCADE');
      table.integer('stock_quantity').notNullable().defaultTo(0);
      table.integer('reserved_quantity').notNullable().defaultTo(0);
      // Optimistic-locking safety net, used alongside SELECT ... FOR UPDATE.
      table.integer('version').notNullable().defaultTo(0);
      table.timestamps(true, true);
    })
    .then(function () {
      return knex.raw(
        'ALTER TABLE inventory ADD CONSTRAINT inventory_stock_quantity_nonneg CHECK (stock_quantity >= 0)'
      );
    })
    .then(function () {
      return knex.raw(
        'ALTER TABLE inventory ADD CONSTRAINT inventory_reserved_quantity_nonneg CHECK (reserved_quantity >= 0)'
      );
    })
    .then(function () {
      return knex.raw(
        'ALTER TABLE inventory ADD CONSTRAINT inventory_reserved_lte_stock CHECK (reserved_quantity <= stock_quantity)'
      );
    });
};

exports.down = function (knex) {
  return knex.schema.dropTableIfExists('inventory');
};
