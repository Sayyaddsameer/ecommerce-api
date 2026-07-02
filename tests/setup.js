process.env.NODE_ENV = 'test';
const db = require('../src/db');

afterAll(async () => {
  await db.destroy();
});
