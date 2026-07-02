require('dotenv').config();

const base = {
  client: 'pg',
  connection:
    process.env.DATABASE_URL ||
    {
      host: process.env.PGHOST || 'localhost',
      port: Number(process.env.PGPORT) || 5432,
      user: process.env.PGUSER || 'ecommerce',
      password: process.env.PGPASSWORD || 'ecommerce_pw',
      database: process.env.PGDATABASE || 'ecommerce',
    },
  migrations: {
    directory: './migrations',
    tableName: 'knex_migrations',
  },
  seeds: {
    directory: './seeds',
  },
  pool: { min: 2, max: 10 },
};

module.exports = {
  development: base,
  test: {
    ...base,
    connection:
      process.env.TEST_DATABASE_URL || process.env.DATABASE_URL || base.connection,
  },
  production: base,
};
