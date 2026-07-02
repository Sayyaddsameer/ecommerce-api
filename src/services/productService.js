const db = require('../db');
const { NotFoundError, ValidationError } = require('../utils/errors');

async function createProduct({ name, description, base_price, category_id, status }) {
  if (!name || !name.trim()) throw new ValidationError('name is required');
  if (base_price === undefined || base_price === null || isNaN(Number(base_price))) {
    throw new ValidationError('base_price is required and must be numeric');
  }
  if (Number(base_price) < 0) throw new ValidationError('base_price must be >= 0');

  if (category_id) {
    const category = await db('categories').where({ id: category_id }).first();
    if (!category) throw new ValidationError(`category_id ${category_id} does not exist`);
  }

  const [product] = await db('products')
    .insert({
      name,
      description,
      base_price,
      category_id: category_id || null,
      status: status || 'active',
    })
    .returning('*');
  return product;
}

async function listProducts({ page = 1, limit = 20, category_id, status } = {}) {
  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
  const offset = (pageNum - 1) * limitNum;

  const query = db('products').orderBy('id');
  if (category_id) query.where({ category_id });
  if (status) query.where({ status });

  const totalQuery = query.clone().clearSelect().clearOrder().count('* as count').first();
  const [rows, totalRow] = await Promise.all([
    query.clone().limit(limitNum).offset(offset),
    totalQuery,
  ]);

  return {
    data: rows,
    pagination: {
      page: pageNum,
      limit: limitNum,
      total: Number(totalRow.count),
      total_pages: Math.ceil(Number(totalRow.count) / limitNum),
    },
  };
}

async function getProductById(id) {
  const product = await db('products').where({ id }).first();
  if (!product) throw new NotFoundError(`Product ${id} not found`);
  return product;
}

async function updateProduct(id, updates) {
  await getProductById(id);
  const allowed = ['name', 'description', 'base_price', 'category_id', 'status'];
  const patch = {};
  for (const key of allowed) {
    if (updates[key] !== undefined) patch[key] = updates[key];
  }
  patch.updated_at = db.fn.now();
  const [product] = await db('products').where({ id }).update(patch).returning('*');
  return product;
}

async function deleteProduct(id) {
  await getProductById(id);
  await db('products').where({ id }).del();
}

module.exports = {
  createProduct,
  listProducts,
  getProductById,
  updateProduct,
  deleteProduct,
};
