const categoryService = require('../services/categoryService');

async function create(req, res, next) {
  try {
    const category = await categoryService.createCategory(req.body);
    res.status(201).json(category);
  } catch (err) {
    next(err);
  }
}

async function list(req, res, next) {
  try {
    const nested = req.query.nested === 'true';
    const categories = await categoryService.listCategories({ nested });
    res.status(200).json(categories);
  } catch (err) {
    next(err);
  }
}

async function getOne(req, res, next) {
  try {
    const category = await categoryService.getCategoryById(req.params.id);
    res.status(200).json(category);
  } catch (err) {
    next(err);
  }
}

module.exports = { create, list, getOne };
