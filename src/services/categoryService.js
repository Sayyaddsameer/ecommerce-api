const db = require('../db');
const { NotFoundError, ValidationError } = require('../utils/errors');

async function createCategory({ name, description, parent_id }) {
  if (!name || !name.trim()) {
    throw new ValidationError('name is required');
  }
  if (parent_id) {
    const parent = await db('categories').where({ id: parent_id }).first();
    if (!parent) throw new ValidationError(`parent_id ${parent_id} does not exist`);
  }
  const [category] = await db('categories')
    .insert({ name, description, parent_id: parent_id || null })
    .returning('*');
  return category;
}

async function listCategories({ nested = false } = {}) {
  const categories = await db('categories').orderBy('id');
  if (!nested) return categories;

  const byId = new Map(categories.map((c) => [c.id, { ...c, children: [] }]));
  const roots = [];
  for (const cat of byId.values()) {
    if (cat.parent_id && byId.has(cat.parent_id)) {
      byId.get(cat.parent_id).children.push(cat);
    } else {
      roots.push(cat);
    }
  }
  return roots;
}

async function getCategoryById(id) {
  const category = await db('categories').where({ id }).first();
  if (!category) throw new NotFoundError(`Category ${id} not found`);
  return category;
}

module.exports = { createCategory, listCategories, getCategoryById };
