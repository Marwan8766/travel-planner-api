const Tour = require('../models/tourModel');
const catchAsync = require('../utils/catchAsync');
const Factory = require('./handlerFactory');
const AppError = require('../utils/appError');
const cloudinary = require('cloudinary').v2;

exports.createTour = catchAsync(async (req, res, next) => {
  let { name, price, summary, description, startLocations, locations } =
    req.body;

  startLocations = JSON.parse(startLocations);
  locations = JSON.parse(locations);

  let image = '';
  if (req.file) {
    const file = req.file;
    console.log(file);
    console.log(cloudinary);
    cloudinary.config({
      cloud_name: process.env.cloud_name,
      api_key: process.env.api_key,
      api_secret: process.env.api_secret,
      secure: true,
    });
    const result = await cloudinary.uploader.upload(file.path, {
      folder: `gallery/profile`,
    });
    const { secure_url } = result;
    image = secure_url;
  }

  const company = req.user._id;

  const doc = await Tour.create({
    name,
    price,
    summary,
    description,
    image,
    startLocations,
    locations,
    company,
  });
  res.status(201).json({
    status: 'success',
    data: {
      data: doc,
    },
  });
});

exports.GetAllTour = Factory.getAll(Tour);
exports.GetTour = Factory.getOne(Tour);

exports.deleteTour = catchAsync(async (req, res, next) => {
  const doc = await Tour.findOneAndDelete({
    _id: req.params.id,
    company: req.user._id,
  });
  if (!doc) return next(new AppError('No document found for that ID', 404));
  res.status(204).json({
    status: 'success',
    data: 'null',
  });
});

exports.Updatetour = catchAsync(async (req, res, next) => {
  const { name, price, summary, description, startLocations, locations } =
    req.body;
  let image = undefined;
  if (req.file) {
    const file = req.file;
    console.log(file);
    console.log(cloudinary);
    cloudinary.config({
      cloud_name: process.env.cloud_name,
      api_key: process.env.api_key,
      api_secret: process.env.api_secret,
      secure: true,
    });
    const result = await cloudinary.uploader.upload(file.path, {
      folder: `gallery/profile`,
    });
    const { secure_url } = result;
    image = secure_url;
  }

  const new_tour = await Tour.findOne({
    _id: req.params.id,
    company: req.user._id,
  });
  if (!new_tour)
    return next(new AppError('No new_tour found for that ID', 404));
  new_tour.name = name ? name : new_tour.name;
  new_tour.price = price ? price : new_tour.price;
  new_tour.summary = summary ? summary : new_tour.summary;
  new_tour.description = description ? description : new_tour.description;
  new_tour.image = image ? image : new_tour.image;
  new_tour.startLocations = startLocations
    ? JSON.parse(startLocations)
    : new_tour.startLocations;
  new_tour.locations = locations ? JSON.parse(locations) : new_tour.locations;

  const tour = await new_tour.save({ validateModifiedOnly: true });
  if (!tour) return next(new AppError('Error updating the tour', 400));

  res.status(200).json({
    status: 'success',
    data: {
      data: tour,
    },
  });
});

exports.getAllMyTours = catchAsync(async (req, res, next) => {
  const tours = await Tour.find({ company: req.user._id });
  if (tours.length === 0) return next(new AppError('No tours found', 404));
  res.status(200).json({
    status: 'success',
    toursLength: tours.length,
    data: {
      tours,
    },
  });
});
