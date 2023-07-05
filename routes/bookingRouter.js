const express = require('express');
// const { myMulter, fileValidation } = require('../utils/multer');
const bookingController = require('../controllers/bookingController');
const authController = require('../controllers/authController');
///////////////////////////////////////////////////////

const router = express.Router();

//////////////////////////////////////
//////////////////////////////////////
// Dashboard
////////////////////////////////
////////////////////////////////

router.get('/LastThreeMonths', bookingController.getAllbooksLastThreeMonths);
router.get('/LastSixMonths', bookingController.getAllbooksLastSixMonths);
router.get('/LastYear', bookingController.getAllbooksLastYear);
router.get(
  '/TheBestFiveTourInLastThreeMonths',
  bookingController.getTheBestFiveTour_InLastThreeMonths
);
router.get(
  '/TheBestFiveTourInLastSixMonths',
  bookingController.getTheBestFiveTour_InLastSixMonths
);
router.get(
  '/TheBestFiveTourInLastYear',
  bookingController.getTheBestFiveTour_InLastYear
);
router.get(
  '/TheBestFiveTripProgramInLastThreeMonths',
  bookingController.getTheBestFiveTripProgram_InLastThreeMonths
);
router.get(
  '/TheBestFiveTripProgramInLastSixMonths',
  bookingController.getTheBestFiveTripProgram_InLastSixMonths
);
router.get(
  '/TheBestFiveTripProgramInLastYear',
  bookingController.getTheBestFiveTripProgram_InLastYear
);
router.get('/TheTrendingCountries', bookingController.getTheTrendingCountries);
router.get('/TheTenToursTrending', bookingController.getTheTenTourIsTrending);
router.get(
  '/TheTenTripProgramsTrending',
  bookingController.getTheTenTripProgramIsTrending
);

////////////////////////////////////////
////////////////////////////////////////
////////////////////////////////////////
// all routes after this middleware is for authienticated users only
router.use(authController.protect);
router.use(authController.restrictTo('user'));

router.get('/', bookingController.getAllbooks);

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
