exports.up = function (knex) {
  return knex.schema.createTable('categories', (table) => {
    table.increments('id').primary();
    table.string('name', 255).notNullable();
    table.text('description');
    table
      .integer('parent_id')
      .unsigned()
      .references('id')
      .inTable('categories')
      .onDelete('SET NULL');
    table.timestamps(true, true);

    table.index('parent_id');
  });
};

exports.down = function (knex) {
  return knex.schema.dropTableIfExists('categories');
};
