const express = require('express');
const router = express.Router();
const { getCart, addItem, updateItemQuantity, removeItem, clearCart } = require('../controllers/cart.controller');
const { authenticate } = require('../middleware/auth.middleware');

// All cart routes require a logged-in user (cart is tied to a user id)
router.use(authenticate);

router.get('/', getCart);
router.post('/items', addItem);
router.patch('/items/:itemId', updateItemQuantity);
router.delete('/items/:itemId', removeItem);
router.delete('/', clearCart);

module.exports = router;
