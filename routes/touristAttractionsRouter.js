const express = require('express');
const touristAttractionsController = require('../controllers/touristAttractions.js');
const { route } = require('./countryRouter.js');

const router = express.Router();

router.get('/', touristAttractionsController.getAllAttractions);

router.get(
  '/:cityId/city',
  touristAttractionsController.getAllAttractionsInCity
);

router.post(
  '/:cityId/city',
  touristAttractionsController.createTouristAttractions
);

module.exports = router;
