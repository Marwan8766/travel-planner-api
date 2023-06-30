const express = require('express');
const dashboardController = require('../controllers/dashboardController');

const router = express.Router();

router.get('/', dashboardController.getBookingChartData);
router.get('/getTopRatings', dashboardController.getTopRatings);

////////////////////////
////////////////////////
////////////////////////

router.get('/totalUsersNum', dashboardController.getTotalUsersNum);
router.get('/totalBookings', dashboardController.getTotalBookingsAndIncome);

router.get(
  '/getMostUsedServiceLastYear',
  dashboardController.getMostUsedServiceLastYear
);

router.get(
  '/getMostUsedServiceLastFourWeeks',
  dashboardController.getMostUsedServiceLastFourWeeks
);

module.exports = router;
