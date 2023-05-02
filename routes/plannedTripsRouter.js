const express = require('express');
const router = express.Router();

// Importing the controllers
const plannedTripsController = require('../controllers/plannedTripsController');
const authController = require('../controllers/authController');

// Protect all routes after this middleware
router.use(authController.protect);

router
  .route('/')
  .get(plannedTripsController.getPlannedTrips) // done
  .post(plannedTripsController.createPlannedTrip); // done

router
  .route('/:id')
  .get(plannedTripsController.getPlannedTripById) // done
  .patch(plannedTripsController.updatePlannedTrip) // done
  .delete(plannedTripsController.deletePlannedTrip); // done

router
  .route('/:id/days/:dayIndex/timeline/:timelineIndex')
  .patch(plannedTripsController.updateTimelineItem) // done
  .delete(plannedTripsController.deleteTimelineItem); // done

// POST /plannedTrips/:id/days
router.post('/:id/days', plannedTripsController.addNewDay); // done

// POST /plannedTrips/:id/customActivities
router.post(
  '/:id/days/:dayIndex/customActivities',
  plannedTripsController.addCustomActivity
); // done

module.exports = router;
