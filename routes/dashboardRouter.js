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

router.get(
  '/getMostUsedServiceLastSevenDays',
  dashboardController.getMostUsedServiceLastSevenDays
);

router.get(
  '/getMostSellingProducts',
  dashboardController.getMostSellingProducts
);

router.get('/getTopCompanies', dashboardController.getTopCompanies);

module.exports = router;
