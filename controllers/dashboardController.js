const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const bookingModel = require('../models/booking.model');
const reviewModel = require('../models/review.model');


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
      new AppError(Could not retrieve booking data: ${err.message}, 400)
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