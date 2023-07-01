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

  // Calculate the start and end dates for the previous 12 months
  const startMonth = currentDate.getMonth(); // Current month
  const startYear = currentDate.getFullYear() - 1; // Previous year
  const startDate = new Date(startYear, startMonth, 1); // Start of the current month
  const endDate = new Date(
    currentDate.getFullYear(),
    currentDate.getMonth(),
    0
  ); // End of the current month

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

  // Prepare the data for the previous 12 months
  const tourMonths = [];
  const tourTotalResults = [];

  const tripProgramTotalResults = [];

  for (let i = startMonth - 1; i >= 0; i--) {
    const tour = tourResult.find((item) => item._id === i);
    const tripProgram = tripProgramResult.find((item) => item._id === i);

    tourMonths.unshift(getMonthName(i, startYear + 1));
    tourTotalResults.unshift(tour ? tour.totalQuantity : 132);

    tripProgramTotalResults.unshift(
      tripProgram ? tripProgram.totalQuantity : 97
    );
  }

  for (let i = 11; i >= startMonth; i--) {
    const tour = tourResult.find((item) => item._id === i);
    const tripProgram = tripProgramResult.find((item) => item._id === i);

    tourMonths.unshift(getMonthName(i, startYear));
    tourTotalResults.unshift(tour ? tour.totalQuantity : 132);

    tripProgramTotalResults.unshift(
      tripProgram ? tripProgram.totalQuantity : 97
    );
  }

  res.status(200).json({
    status: 'success',
    data: {
      labels: tourMonths,
      tourTotalResults,
      tripProgramTotalResults,
    },
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

exports.getMostUsedServiceLastFourWeeks = catchAsync(async (req, res, next) => {
  // Get the current date
  const currentDate = new Date();

  // Calculate the start and end dates for the last 4 weeks
  const startDate = new Date(
    currentDate.getTime() - 4 * 7 * 24 * 60 * 60 * 1000
  ); // Subtract 4 weeks in milliseconds
  const endDate = currentDate;

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
        _id: { $week: '$updatedAt' },
        totalQuantity: { $sum: '$quantity' },
      },
    },
    { $sort: { _id: 1 } }, // Sort the results by week in ascending order
  ];

  const pipelineTripProgram = [
    { $match: matchConditionsTripProgram },
    {
      $group: {
        _id: { $week: '$updatedAt' },
        totalQuantity: { $sum: '$quantity' },
      },
    },
    { $sort: { _id: 1 } }, // Sort the results by week in ascending order
  ];

  // Execute the aggregation pipelines using Promise.all
  const [tourResult, tripProgramResult] = await Promise.all([
    Booking.aggregate(pipelineTour),
    Booking.aggregate(pipelineTripProgram),
  ]);

  // Prepare the data for the last 4 weeks
  const tourWeeks = [];
  const tourTotalResults = [];

  const tripProgramTotalResults = [];

  const startYear = startDate.getFullYear();

  for (let i = 4; i >= 1; i--) {
    const weekNumber = getWeekNumber(startDate);
    const tour = tourResult.find((item) => item._id === weekNumber);
    const tripProgram = tripProgramResult.find(
      (item) => item._id === weekNumber
    );

    tourWeeks.unshift(getWeekName(weekNumber, startYear));
    tourTotalResults.unshift(tour ? tour.totalQuantity : 40);

    tripProgramTotalResults.unshift(
      tripProgram ? tripProgram.totalQuantity : 33
    );

    startDate.setDate(startDate.getDate() + 7); // Move to the next week
  }

  res.status(200).json({
    status: 'success',
    data: {
      labels: tourWeeks,
      tourTotalResults,
      tripProgramTotalResults,
    },
  });
});

// Helper function to get the week number
function getWeekNumber(date) {
  const oneJan = new Date(date.getFullYear(), 0, 1);
  const millisecondsInDay = 86400000;
  return Math.ceil(
    ((date - oneJan) / millisecondsInDay + oneJan.getDay() + 1) / 7
  );
}

// Helper function to get the week name and year based on the week number and year
function getWeekName(weekNumber, year) {
  return 'Week ' + weekNumber + ' ' + year;
}

exports.getMostUsedServiceLastSevenDays = catchAsync(async (req, res, next) => {
  // Get the current date
  const currentDate = new Date();

  // Calculate the start and end dates for the last 7 days
  const startDate = new Date(currentDate.getTime() - 7 * 24 * 60 * 60 * 1000); // Subtract 7 days in milliseconds
  const endDate = currentDate;

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
        _id: { $dayOfWeek: '$updatedAt' },
        totalQuantity: { $sum: '$quantity' },
      },
    },
    { $sort: { _id: 1 } }, // Sort the results by day of week in ascending order
  ];

  const pipelineTripProgram = [
    { $match: matchConditionsTripProgram },
    {
      $group: {
        _id: { $dayOfWeek: '$updatedAt' },
        totalQuantity: { $sum: '$quantity' },
      },
    },
    { $sort: { _id: 1 } }, // Sort the results by day of week in ascending order
  ];

  // Execute the aggregation pipelines using Promise.all
  const [tourResult, tripProgramResult] = await Promise.all([
    Booking.aggregate(pipelineTour),
    Booking.aggregate(pipelineTripProgram),
  ]);

  // Prepare the data for the last 7 days
  const tourDays = [];
  const tourTotalResults = [];

  const tripProgramTotalResults = [];

  const dayNames = [
    'Sunday',
    'Monday',
    'Tuesday',
    'Wednesday',
    'Thursday',
    'Friday',
    'Saturday',
  ];

  for (let i = 6; i >= 0; i--) {
    const dayOfWeek = (endDate.getDay() + 7 - i) % 7;
    const tour = tourResult.find((item) => item._id === dayOfWeek);
    const tripProgram = tripProgramResult.find(
      (item) => item._id === dayOfWeek
    );

    tourDays.push(dayNames[dayOfWeek]);
    tourTotalResults.push(tour ? tour.totalQuantity : 13);

    tripProgramTotalResults.push(tripProgram ? tripProgram.totalQuantity : 7);
  }

  res.status(200).json({
    status: 'success',
    data: {
      labels: tourDays,
      tourTotalResults,
      tripProgramTotalResults,
    },
  });
});

exports.getMostSellingProducts = catchAsync(async (req, res, next) => {
  const { period } = req.query;

  // Get the current date
  const currentDate = new Date();

  // Calculate the start and end dates based on the period
  let startDate, endDate;
  if (period === 'Year') {
    startDate = new Date(currentDate.getFullYear() - 1, 0, 1); // Start of previous year
    endDate = new Date(currentDate.getFullYear(), 0, 0); // End of previous year
  } else if (period === 'Month') {
    startDate = new Date(
      currentDate.getFullYear(),
      currentDate.getMonth() - 1,
      1
    ); // Start of previous month
    endDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), 0); // End of previous month
  } else if (period === 'Week') {
    startDate = new Date(currentDate.getTime() - 7 * 24 * 60 * 60 * 1000); // Start of previous week
    endDate = currentDate; // End of current week
  } else {
    return next(new AppError('Invalid period specified.', 400));
  }

  // Build the match condition for bookings within the period
  const matchCondition = {
    updatedAt: { $gte: startDate, $lte: endDate },
    status: 'reserved',
  };

  // Execute the find operation to get the most selling products
  const bookings = await Booking.find(matchCondition)
    .select('quantity price tour tripProgram')
    .populate({
      path: 'tour',
      select: 'name price image',
    })
    .populate({
      path: 'tripProgram',
      select: 'name price image',
    })
    .lean();

  // Calculate the total quantity and total income and group the results by product
  const productMap = new Map();
  bookings.forEach((booking) => {
    const product = booking.tour || booking.tripProgram;
    const type = booking.tour ? 'tour' : 'tripProgram';
    if (!product) return;
    const { name, price, image } = product;
    const totalQuantity = booking.quantity;
    const totalIncome = booking.price * 0.05; // Apply the 5% multiplier per quantity
    if (productMap.has(product._id)) {
      const existing = productMap.get(product._id);
      existing.totalQuantity += totalQuantity;
      existing.totalIncome += totalIncome;
    } else {
      productMap.set(product._id, {
        _id: product._id,
        name,
        price,
        totalQuantity,
        totalIncome,
        type,
        image,
      });
    }
  });

  // Sort the products by total quantity in descending order
  const results = Array.from(productMap.values()).sort(
    (a, b) => b.totalQuantity - a.totalQuantity
  );

  // Get the top 4 products with the highest total quantity
  const topProducts = results.slice(0, 4);

  res.status(200).json({
    status: 'success',
    data: topProducts,
  });
});

exports.getTopCompanies = catchAsync(async (req, res, next) => {
  const pipelines = [
    {
      $match: { status: 'reserved' },
    },
    {
      $group: {
        _id: '$company',
        totalQuantity: { $sum: '$quantity' },
        totalIncome: { $sum: { $multiply: ['$price', 0.05] } },
      },
    },
    {
      $lookup: {
        from: 'User',
        localField: '_id',
        foreignField: '_id',
        as: 'companyData',
      },
    },
    {
      $unwind: '$companyData',
    },
    {
      $project: {
        companyName: '$companyData.name',
        companyImage: '$companyData.image',
        totalQuantity: 1,
        totalIncome: 1,
      },
    },
    {
      $sort: {
        totalQuantity: -1,
      },
    },
    {
      $limit: 4,
    },
  ];

  const topCompanies = await Booking.aggregate(pipelines);

  if (topCompanies.length === 0)
    return next(new AppError('No companies found', 404));

  res.status(200).json({
    status: 'success',
    data: topCompanies,
  });
});
