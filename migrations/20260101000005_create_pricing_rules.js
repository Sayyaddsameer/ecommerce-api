exports.up = function (knex) {
  return knex.schema.createTable('pricing_rules', (table) => {
    table.increments('id').primary();
    table.string('name', 255).notNullable();
    table
      .enu('rule_type', ['USER_TIER', 'BULK', 'PROMO_CODE', 'SEASONAL'], {
        useNative: true,
        enumName: 'pricing_rule_type',
      })
      .notNullable();
    // Lower number = applied earlier in the pipeline.
    table.integer('priority').notNullable().defaultTo(100);
    table
      .enu('discount_type', ['PERCENTAGE', 'FIXED'], {
        useNative: true,
        enumName: 'pricing_discount_type',
      })
      .notNullable()
      .defaultTo('PERCENTAGE');
    // For PERCENTAGE: 10.00 means 10%. For FIXED: an absolute currency amount.
    table.decimal('discount_value', 10, 2).notNullable();
    // Arbitrary JSON describing when the rule applies, e.g.
    // {"min_quantity": 5} for BULK, {"tier": "gold"} for USER_TIER,
    // {"code": "SUMMER10"} for PROMO_CODE.
    table.jsonb('condition_payload').notNullable().defaultTo('{}');
    table.boolean('is_active').notNullable().defaultTo(true);
    table.timestamp('starts_at');
    table.timestamp('ends_at');
    table.timestamps(true, true);

    table.index(['is_active', 'priority']);
    table.index('rule_type');
  });
};

exports.down = function (knex) {
  return knex.schema
    .dropTableIfExists('pricing_rules')
    .then(function () {
      return knex.raw('DROP TYPE IF EXISTS pricing_rule_type');
    })
    .then(function () {
      return knex.raw('DROP TYPE IF EXISTS pricing_discount_type');
    });
};
