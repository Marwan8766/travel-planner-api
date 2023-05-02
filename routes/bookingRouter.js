const express = require('express');
// const { myMulter, fileValidation } = require('../utils/multer');
const bookingController = require('../controllers/bookingController');
const authController = require('../controllers/authController');
///////////////////////////////////////////////////////

const router = express.Router();

router.get('/', bookingController.getAllbooks);

// all routes after this middleware is for authienticated users only
router.use(authController.protect);

router.post(
  '/stripe/create-payment-intent',
  bookingController.createStripeCheckoutItems,
  bookingController.createStripeCheckoutItemsBooking,
  bookingController.createStripePaymentSession
);

// router.post('/bookTour/:id', bookingController.createTourBook);

// router.post('/bookTripProgram/:id', bookingController.createTripProgramBook);

// router.delete('/:id', bookingController.deleteBook);

module.exports = router;
// Only admin can use the following routes after this middleware
router.use(authController.restrictTo('admin'));
