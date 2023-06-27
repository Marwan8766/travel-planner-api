const express = require('express');
const dashboardController = require('../controllers/dashboardController');

const router = express.Router();

router.get('/', dashboardController.getBookingChartData);
router.get('/getTopRatings', dashboardController.getTopRatings);

module.exports = router;
