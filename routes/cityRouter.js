const express = require('express');
const cityController = require('../controllers/cityController');
const authController = require('../controllers/authController');

const router = express.Router();

router.get('/', cityController.getAllCities);
router.get('/:cityId', cityController.getCity);

// Protect all routes after this middleware
router.use(authController.protect);
// only admin
router.use(authController.restrictTo('admin'));

router.post('/', cityController.createCity); // only admin
router
  .route('/:cityId')
  .patch(cityController.updateCity)
  .delete(cityController.deleteCity);

module.exports = router;
