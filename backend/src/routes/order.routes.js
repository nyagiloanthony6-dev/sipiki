const express = require('express');
const router = express.Router();
const orders = require('../controllers/order.controller');
const { orderLimiter, trackLimiter } = require('../middleware/rateLimit.middleware');

// Public: a customer needs no account — just phone number and delivery location
router.post('/', orderLimiter, orders.createOrder);
router.post('/track', trackLimiter, orders.trackOrder);

module.exports = router;
