const express = require('express');
const availabilityController = require('../controllers/availabilityController');
const authController = require('../controllers/authController');
///////////////////////////////////////////////////////

const router = express.Router();

router.get('/:id', availabilityController.getAvailabilities);

router.get('/:id/item', availabilityController.getAvailability);

// Protect all routes after this middleware
router.use(authController.protect);

// protect all routes after this middleware for admins only or company
router.use(authController.restrictTo('admin', 'company'));

// check that the company created that tour or tripProgram is the one updating it or it is the admin who is updating

router.post(
  '/:id',
  availabilityController.restrictAvailability,
  availabilityController.createAvailability
);

router.patch(
  '/:id',
  availabilityController.restrictAvailability,
  availabilityController.updateAvailability
);

router.delete(
  '/:id',
  availabilityController.restrictAvailability,
  availabilityController.deleteAvailability
);

module.exports = router;
