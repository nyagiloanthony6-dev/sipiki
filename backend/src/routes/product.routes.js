const express = require('express');
const router = express.Router();
const { listProducts, getProductBySlug, listProductCategories } = require('../controllers/product.controller');

// Public catalog (read-only). Vendors add and edit products through /api/vendors/me/products.
router.get('/', listProducts);
router.get('/categories', listProductCategories); // must stay above '/:slug'
router.get('/:slug', getProductBySlug);

module.exports = router;
