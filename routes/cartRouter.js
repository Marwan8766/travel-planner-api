const express = require('express');
const cartController = require('../controllers/cartController');
const authController = require('../controllers/authController');

const router = express.Router();

// Protect all routes after this middleware
router.use(authController.protect);

router.post(
  '/',
  cartController.checkAddedItemsAddAvailability,
  cartController.createCartItems
);

router.post(
  '/cart',
  cartController.checkAddedItemsAddAvailability,
  cartController.addToCart
);

router.use(cartController.checkCartItemsAvailability);

router.get('/', cartController.getCart);

router.delete('/', cartController.emptyCart);

router.delete('/cart', cartController.deleteCartItem);

module.exports = router;
