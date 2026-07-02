exports.up = function (knex) {
  return knex.schema.createTable('carts', (table) => {
    table.increments('id').primary();
    // Kept as a loose string so the API works without a full auth system;
    // in production this would be a FK to a users table.
    table.string('user_id', 255);
    table
      .enu('status', ['active', 'checked_out', 'abandoned'], {
        useNative: true,
        enumName: 'cart_status',
      })
      .notNullable()
      .defaultTo('active');
    table.timestamps(true, true);

    table.index('user_id');
    table.index('status');
  });
};

exports.down = function (knex) {
  return knex.schema.dropTableIfExists('carts').then(() =>
    knex.raw('DROP TYPE IF EXISTS cart_status')
  );
};
