const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const bookingModel = require('../models/booking.model');
const reviewModel = require('../models/review.model');
const User = require('../models/userModel');
const Booking = require('../models/booking.model');

exports.getBookingChartData = catchAsync(async (req, res, next) => {
  // Get the current date
  const currentDate = new Date();

  // Get the start of the day
  const startOfDay = new Date(
    currentDate.getFullYear(),
    currentDate.getMonth(),
    currentDate.getDate()
  );

  // Calculate the start of the month
  const startOfMonth = new Date(
    currentDate.getFullYear(),
    currentDate.getMonth(),
    1
  );

  // Calculate the start of the year
  const startOfYear = new Date(currentDate.getFullYear(), 0, 1);

  try {
    // Get daily bookings
    const dailyBookings = await bookingModel.find({
      CreatedAt: { $gte: startOfDay },
    });

    // Get monthly bookings
    const monthlyBookings = await bookingModel.find({
      CreatedAt: { $gte: startOfMonth },
    });

    // Get yearly bookings
    const yearlyBookings = await bookingModel.find({
      CreatedAt: { $gte: startOfYear },
    });

    res.status(200).json({
      status: 'success',
      data: {
        dailyBookings,
        monthlyBookings,
        yearlyBookings,
      },
    });
  } catch (err) {
    return next(
      new AppError(`Could not retrieve booking data: ${err.message}`, 400)
    );
  }
});

exports.getTopRatings = catchAsync(async (req, res, next) => {
  // Get the top 5 rated companies
  const topRatedCompanies = await reviewModel.aggregate([
    {
      $match: { company: { $exists: true } },
    },
    {
      $group: {
        _id: '$company',
        averageRating: { $avg: '$rating' },
      },
    },
    {
      $lookup: {
        from: 'users',
        localField: '_id',
        foreignField: '_id',
        as: 'company',
      },
    },
    {
      $unwind: '$company',
    },
    {
      $project: {
        _id: 0,
        name: '$company.name',
        rating: '$averageRating',
      },
    },
    {
      $sort: { rating: -1 },
    },
    {
      $limit: 5,
    },
  ]);

  // Get the top 5 rated tours with associated company name
  const topRatedTours = await reviewModel.aggregate([
    {
      $match: { tour: { $exists: true } },
    },
    {
      $group: {
        _id: '$tour',
        averageRating: { $avg: '$rating' },
      },
    },
    {
      $lookup: {
        from: 'tours',
        localField: '_id',
        foreignField: '_id',
        as: 'tour',
      },
    },
    {
      $unwind: '$tour',
    },
    {
      $lookup: {
        from: 'users',
        localField: 'tour.company',
        foreignField: '_id',
        as: 'company',
      },
    },
    {
      $unwind: '$company',
    },
    {
      $project: {
        _id: 0,
        name: '$tour.name',
        company: '$company.name',
        rating: '$averageRating',
      },
    },
    {
      $sort: { rating: -1 },
    },
    {
      $limit: 5,
    },
  ]);

  // Get the top 5 rated trip programs with associated company name
  const topRatedTripPrograms = await reviewModel.aggregate([
    {
      $match: { tripProgram: { $exists: true } },
    },
    {
      $group: {
        _id: '$tripProgram',
        averageRating: { $avg: '$rating' },
      },
    },
    {
      $lookup: {
        from: 'tripprograms',
        localField: '_id',
        foreignField: '_id',
        as: 'tripProgram',
      },
    },
    {
      $unwind: '$tripProgram',
    },
    {
      $lookup: {
        from: 'users',
        localField: 'tripProgram.company',
        foreignField: '_id',
        as: 'company',
      },
    },
    {
      $unwind: '$company',
    },
    {
      $project: {
        _id: 0,
        name: '$tripProgram.name',
        company: '$company.name',
        rating: '$averageRating',
      },
    },
    {
      $sort: { rating: -1 },
    },
    {
      $limit: 5,
    },
  ]);

  res.status(200).json({
    status: 'success',
    data: {
      topRatedCompanies,
      topRatedTours,
      topRatedTripPrograms,
    },
  });
});

///////////////////////////////////////////
///////////////////////////////////////////
///////////////////////////////////////////
///////////////////////////////////////////

exports.getTotalUsersNum = catchAsync(async (req, res, next) => {
  const { userRole } = req.query;

  const query = {};
  if (userRole === 'user') {
    query.role = 'user';
  }

  if (userRole === 'company') {
    query.role = 'company';
  }

  const usersNum = await User.countDocuments(query);

  res.status(200).json({
    status: 'success',
    data: {
      usersCount: usersNum,
    },
  });
});

exports.getTotalBookingsAndIncome = catchAsync(async (req, res, next) => {
  const totalBookingsPromise = Booking.countDocuments({
    status: 'reserved',
    paid: true,
  });
  const totalIncomePromise = Booking.aggregate([
    {
      $match: { status: 'reserved' },
    },
    {
      $group: {
        _id: null,
        totalIncome: { $sum: { $multiply: ['$price', 0.05] } },
      },
    },
  ]);

  const [totalBookings, totalIncomeResults] = await Promise.all([
    totalBookingsPromise,
    totalIncomePromise,
  ]);
  const totalIncome =
    totalIncomeResults.length > 0 ? totalIncomeResults[0].totalIncome : 0;

  res.status(200).json({
    status: 'success',
    data: {
      totalBookings,
      totalIncome,
    },
  });
});

exports.getMostUsedServiceLastYear = catchAsync(async (req, res, next) => {
  // Get the current date
  const currentDate = new Date();

  // Calculate the start and end dates for the current month
  const currentMonth = currentDate.getMonth();
  const currentYear = currentDate.getFullYear();
  const startMonth = currentMonth === 0 ? 11 : currentMonth - 1; // If current month is January, set start month to December of previous year
  const startDate = new Date(currentYear, startMonth, 1); // Start of the current month
  const endDate = new Date(currentYear, currentMonth, 0); // End of the current month

  // Build the match conditions for tours and trip programs
  const matchConditionsTour = {
    updatedAt: { $gte: startDate, $lte: endDate },
    status: 'reserved',
    tour: { $ne: null },
  };

  const matchConditionsTripProgram = {
    updatedAt: { $gte: startDate, $lte: endDate },
    status: 'reserved',
    tripProgram: { $ne: null },
  };

  // Build the aggregation pipelines for tours and trip programs
  const pipelineTour = [
    { $match: matchConditionsTour },
    {
      $group: {
        _id: { $month: '$updatedAt' },
        totalQuantity: { $sum: '$quantity' },
      },
    },
    { $sort: { _id: 1 } }, // Sort the results by month in ascending order
  ];

  const pipelineTripProgram = [
    { $match: matchConditionsTripProgram },
    {
      $group: {
        _id: { $month: '$updatedAt' },
        totalQuantity: { $sum: '$quantity' },
      },
    },
    { $sort: { _id: 1 } }, // Sort the results by month in ascending order
  ];

  // Execute the aggregation pipelines using Promise.all
  const [tourResult, tripProgramResult] = await Promise.all([
    Booking.aggregate(pipelineTour),
    Booking.aggregate(pipelineTripProgram),
  ]);

  // Prepare the data for the previous 11 months in the previous year
  const tourMonths = [];
  const tourTotalResults = [];

  const tripProgramMonths = [];
  const tripProgramTotalResults = [];

  // Prepare the data for the previous 11 months
  for (let i = startMonth; i >= 0; i--) {
    const tour = tourResult.find((item) => item._id === i);
    const tripProgram = tripProgramResult.find((item) => item._id === i);

    tourMonths.unshift(getMonthName(i, currentYear - 1));
    tourTotalResults.unshift(tour ? tour.totalQuantity : 0);

    tripProgramMonths.unshift(getMonthName(i, currentYear - 1));
    tripProgramTotalResults.unshift(
      tripProgram ? tripProgram.totalQuantity : 0
    );
  }

  // Prepare the data for the current month in the current year
  const currentMonthTour = tourResult.find((item) => item._id === currentMonth);
  const currentMonthTripProgram = tripProgramResult.find(
    (item) => item._id === currentMonth
  );

  tourMonths.push(getMonthName(currentMonth, currentYear));
  tourTotalResults.push(currentMonthTour ? currentMonthTour.totalQuantity : 0);

  tripProgramMonths.push(getMonthName(currentMonth, currentYear));
  tripProgramTotalResults.push(
    currentMonthTripProgram ? currentMonthTripProgram.totalQuantity : 0
  );

  res.status(200).json({
    status: 'success',
    data: [
      {
        months: tourMonths,
        totalResults: tourTotalResults,
      },
      {
        months: tripProgramMonths,
        totalResults: tripProgramTotalResults,
      },
    ],
  });
});

// Helper function to get the month name and year based on the month number and year
function getMonthName(monthNumber, year) {
  const monthNames = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ];
  return monthNames[monthNumber] + ' ' + year;
}
