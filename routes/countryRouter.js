const express = require('express');
const countryController = require('../controllers/countryController');
const authController = require('../controllers/authController');

const router = express.Router();

router.get('/', countryController.getAllCountries);
router.get('/:countryId', countryController.getCountry);
router.get('/:countryId/cities', countryController.getAllCountryCities);

// Protect all routes after this middleware
router.use(authController.protect);
// only admin
router.use(authController.restrictTo('admin'));

router.post('/', countryController.createCountry); // only admin
router
  .route('/:countryId')
  .patch(countryController.updateCountry)
  .delete(countryController.deleteCountry);

module.exports = router;
