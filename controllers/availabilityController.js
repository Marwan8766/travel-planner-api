const AppError = require('../utils/appError');
const catchAsync = require('../utils/catchAsync');
const Availability = require('../models/availabilityModel');
const Tour = require('../models/tourModel');
const TripProgram = require('../models/tripProgramsmodel');

// Create availability for a tour or trip program
exports.createAvailability = async (req, res, next) => {
  const { startDate, endDate, availableSeats } = req.body;
  const { id } = req.params;
  const { itemType } = req;

  // Create availability for each date between startDate and endDate
  for (
    let date = new Date(startDate);
    date <= new Date(endDate);
    date.setDate(date.getDate() + 1)
  ) {
    if (itemType === 'tour') {
      await Availability.create({
        tour: id,
        date,
        availableSeats,
      });
    }
    if (itemType === 'tripProgram') {
      await Availability.create({
        tripProgram: id,
        date,
        availableSeats,
      });
    }
  }

  res.status(201).json({
    status: 'success',
    message: 'Availability created successfully',
  });
};

// update availabilty based on tour or tripProgram and date
exports.updateAvailability = catchAsync(async (req, res, next) => {
  const { date, availableSeats, newDate } = req.body;
  const { id } = req.params;
  const { itemType } = req;

  const query = {};

  if (itemType === 'tour') {
    query.tour = id;
  } else if (itemType === 'tripProgram') {
    query.tripProgram = id;
  }

  query.date = date;

  const availability = await Availability.findOne(query);

  if (!availability) {
    return next(new AppError('Availability not found', 404));
  }

  availability.availableSeats = availableSeats
    ? availableSeats
    : availability.availableSeats;

  availability.date = newDate ? newDate : availability.date;

  const updatedAvailability = await availability.save({
    validateModifiedOnly: true,
  });

  res.status(200).json({
    status: 'success',
    message: 'Availability updated successfully',
    data: { availability: updatedAvailability },
  });
});

exports.deleteAvailability = catchAsync(async (req, res, next) => {
  const { date } = req.body;
  const { id } = req.params;
  const { itemType } = req;

  const query = {};

  if (itemType === 'tour') {
    query.tour = id;
  } else if (itemType === 'tripProgram') {
    query.tripProgram = id;
  }

  query.date = date;

  const availability = await Availability.findOneAndDelete(query);

  if (!availability) {
    return next(new AppError('Availability not found', 404));
  }

  res.status(204).json({
    status: 'success',
    message: 'Availability deleted successfully',
    data: null,
  });
});

exports.getAvailabilities = catchAsync(async (req, res, next) => {
  const { startDate, endDate } = req.query;
  const { id, itemType } = req.params;

  const query = {};

  if (itemType === 'tour') {
    const tour = await Tour.findById(id);
    if (!tour) return next(new AppError('Tour not found', 404));
    query.tour = id;
  } else if (itemType === 'tripProgram') {
    const tripProgram = await TripProgram.findById(id);
    if (!tripProgram) return next(new AppError('Trip program not found', 404));
    query.tripProgram = id;
  }

  if (startDate && endDate) {
    query.date = {
      $gte: new Date(startDate),
      $lte: new Date(endDate),
    };
  }

  const availabilities = await Availability.find(query);

  if (availabilities.length === 0)
    return next(new AppError('No availabilities found for those dates', 404));

  res.status(200).json({
    status: 'success',
    results: availabilities.length,
    data: { availabilities },
  });
});

exports.getAvailability = catchAsync(async (req, res, next) => {
  const { date } = req.body;
  const { id, itemType } = req.params;

  const query = {};

  if (itemType === 'tour') {
    const tour = await Tour.findById(id);
    if (!tour) return next(new AppError('Tour not found', 404));
    query.tour = id;
  } else if (itemType === 'tripProgram') {
    const tripProgram = await TripProgram.findById(id);
    if (!tripProgram) return next(new AppError('Trip program not found', 404));
    query.tripProgram = id;
  }

  query.date = date;

  const availability = await Availability.findOne(query);

  if (!availability)
    return next(new AppError('No availability found for this query', 404));

  res.status(200).json({
    status: 'success',
    data: {
      availability,
    },
  });
});

exports.restrictAvailability = catchAsync(async (req, res, next) => {
  // get the item id from params
  const id = req.params.id;
  let type;

  // search with the id in tour and in tripProgram
  let item = await Tour.findById(id);
  type = 'tour';
  if (!item) {
    item = await TripProgram.findById(id);
    type = 'tripProgram';
  }
  if (!item)
    return next(
      new AppError('The id must belong to a tour or a tripProgram', 404)
    );

  // add the type to the request
  req.itemType = type;

  // check if the user is the admin
  if (req.user.role === 'admin') return next();

  // check that the company making this req is the one that owns that item
  if (req.user._id !== item.company)
    return next(
      new AppError('You donot have the permission to perform that action', 403)
    );

  // if everything ok add the type and the item in req return next
  next();
});
