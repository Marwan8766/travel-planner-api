const AppError = require('../utils/appError');
const catchAsync = require('../utils/catchAsync');
const Availability = require('../models/availabilityModel');
const Tour = require('../models/tourModel');
const TripProgram = require('../models/tripProgramsmodel');
const mongoose = require('mongoose');

// Create availability for a tour or trip program
exports.createAvailability = async (req, res, next) => {
  const { startDate, endDate, availableSeats } = req.body;
  const { itemType, item } = req;

  let createdAvailability;
  // Create availability for each date between startDate and endDate
  for (
    let date = new Date(startDate);
    date <= new Date(endDate);
    date.setDate(date.getDate() + 1)
  ) {
    if (itemType === 'tour') {
      createdAvailability = await Availability.create({
        tour: item._id,
        date,
        availableSeats,
      });
    }
    if (itemType === 'tripProgram') {
      createdAvailability = await Availability.create({
        tripProgram: item._id,
        date,
        availableSeats,
      });
    }
  }

  if (!createdAvailability) {
    console.log(
      `availability failed to be created data :::  item:${item} , itemType: ${itemType},  startDate: ${startDate} , endDate: ${endDate}, availableSeats: ${availableSeats}`
    );
    return next(new AppError('Error creating the availability', 400));
  }

  res.status(201).json({
    status: 'success',
    message: 'Availability created successfully',
  });
};

// update availabilty based on tour or tripProgram and date
exports.updateAvailability = catchAsync(async (req, res, next) => {
  const { date, availableSeats, newDate } = req.body;
  const { itemType, item } = req;

  const query = {};

  if (itemType === 'tour') {
    query.tour = item._id;
  } else if (itemType === 'tripProgram') {
    query.tripProgram = item._id;
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
  const { itemType, item } = req;

  const query = {};

  if (itemType === 'tour') {
    query.tour = item._id;
  } else if (itemType === 'tripProgram') {
    query.tripProgram = item._id;
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
  const { id } = req.params;

  const query = {};

  let item = await Tour.findById(id);
  if (item) {
    query.tour = item._id;
  } else {
    item = await TripProgram.findById(id);
    query.tripProgram = item._id;
  }

  if (!item)
    return next(
      new AppError('Couldnot find the item in the availability', 404)
    );

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
  const { id } = req.params;

  const query = {};

  let item = await Tour.findById(id);
  if (item) {
    query.tour = id;
  } else {
    item = await TripProgram.findById(id);
    query.tripProgram = item._id;
  }

  if (!item)
    return next(
      new AppError('Couldnot find the item in the availability', 404)
    );

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
  console.log(`id:  ${req.params.id}`);
  const id = mongoose.Types.ObjectId(req.params.id);
  console.log(`id object:  ${id}`);

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
  console.log('doooooneee');
  req.itemType = type;
  req.item = item;
  // check if the user is the admin
  if (req.user.role === 'admin') return next();

  console.log(`user id: ${req.user._id}, type: ${typeof req.user._id}`);
  console.log(`company id: ${item.company} , type: ${typeof item.company}`);

  // check that the company making this req is the one that owns that item
  if (req.user._id.toString() !== item.company.toString())
    return next(
      new AppError('You donot have the permission to perform that action', 403)
    );

  // if everything ok add the type and the item in req return next
  next();
});
