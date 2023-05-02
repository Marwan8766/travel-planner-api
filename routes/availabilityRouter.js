const express = require('express');
const availabilityController = require('../controllers/availabilityController');
const authController = require('../controllers/authController');
///////////////////////////////////////////////////////

const router = express.Router();

router.get('/:id/:itemType', availabilityController.getAvailabilities);

router.get('/:id/:itemType/item', availabilityController.getAvailability);

// Protect all routes after this middleware
router.use(authController.protect);

// protect all routes after this middleware for admins only or company
router.use(authController.restrictTo('admin', 'company'));

// check that the company created that tour or tripProgram is the one updating it or it is the admin who is updating
router.use(availabilityController.restrictAvailability);

router.post('/:id', availabilityController.createAvailability);

router.patch('/:id', availabilityController.updateAvailability);

router.delete('/:id', availabilityController.deleteAvailability);

module.exports = router;
