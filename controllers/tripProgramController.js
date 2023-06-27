const TripProgram = require('../models/tripProgramsmodel');
const plannedTripController = require('./plannedTripsController');
const catchAsync = require('../utils/catchAsync');
const Factory = require('./handlerFactory');
const AppError = require('../utils/appError');
const cloudinary = require('cloudinary').v2;
const mongoose = require('mongoose');

exports.createTripProgram = catchAsync(async (req, res, next) => {
  let { name, price, summary, description, startLocations, locations, tour } =
    req.body;

  startLocations = JSON.parse(startLocations);
  locations = JSON.parse(locations);

  const ObjectId = mongoose.Types.ObjectId;

  const tourIds = tour.split(','); // assuming tour is a comma-separated string of IDs
  const tourObjectIds = tourIds.map((id) => mongoose.Types.ObjectId(id));

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
  const doc = await TripProgram.create({
    name,
    price,
    summary,
    description,
    image,
    startLocations,
    locations,
    tour: tourObjectIds,
    company,
  });
  res.status(201).json({
    status: 'success',
    data: {
      data: doc,
    },
  });
});

exports.deleteTripProgram = catchAsync(async (req, res, next) => {
  const doc = await TripProgram.findOneAndDelete({
    _id: req.params.id,
    company: req.user._id,
  });
  if (!doc) return next(new AppError('No document found for that ID', 404));
  res.status(204).json({
    status: 'success',
    data: 'null',
  });
});

exports.UpdateTripProgram = catchAsync(async (req, res, next) => {
  const { name, price, summary, description, startLocations, locations, tour } =
    req.body;
  const tourIds = tour.split(','); // assuming tour is a comma-separated string of IDs
  const tourObjectIds = tourIds.map((id) => mongoose.Types.ObjectId(id));
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

  const doc = await TripProgram.findOne({
    _id: req.params.id,
    company: req.user._id,
  });
  if (!doc) return next(new AppError('No document found for that ID', 404));
  doc.name = name ? name : doc.name;
  doc.price = price ? price : doc.price;
  doc.summary = summary ? summary : doc.summary;
  doc.description = description ? description : doc.description;
  doc.image = image ? image : doc.image;
  doc.startLocations = startLocations
    ? JSON.parse(startLocations)
    : doc.startLocations;
  doc.locations = locations ? JSON.parse(locations) : doc.locations;
  doc.tour = tour ? tourObjectIds : doc.tour;

  const tripProgram = await doc.save({ validateModifiedOnly: true });
  if (!tripProgram)
    return next(new AppError('Error updating the tripProgram', 400));

  res.status(200).json({
    status: 'success',
    data: {
      data: doc,
    },
  });
});

exports.GetAllTripProgram = catchAsync(async (req, res, next) => {
  const page = req.query.page * 1 || 1;
  const limit = req.query.limit * 1 || 5;
  const skip = (page - 1) * limit;

  // Filter by minimum and maximum price
  const minPrice = req.query.minPrice * 1 || 0;
  const maxPrice = req.query.maxPrice * 1 || Infinity;
  const priceFilter = {
    price: { $gte: minPrice, $lte: maxPrice },
  };

  // Sort by price in ascending or descending order
  let sort;
  if (req.query.sort === 'asc') {
    sort = { price: 1 }; // ascending order
  } else if (req.query.sort === 'desc') {
    sort = { price: -1 }; // descending order
  }

  let query = await TripProgram.find(priceFilter)
    .populate('company')
    .skip(skip)
    .limit(limit);

  let totalQuery = await TripProgram.countDocuments(priceFilter);

  if (req.query.cityName) {
    const cityName = req.query.cityName;
    const { radius, lat, lng } = await plannedTripController.getCityRadius(
      cityName
    );

    query = await TripProgram.find({
      'startLocations.coordinates': {
        $geoWithin: {
          $centerSphere: [[lng, lat], radius],
        },
      },
    });

    totalQuery = await TripProgram.find({
      'startLocations.coordinates': {
        $geoWithin: {
          $centerSphere: [[lng, lat], radius],
        },
      },
    });
  }

  const sortByPrice = (a, b) => {
    if (sort.price === 1) {
      return a.price - b.price; // Ascending order
    } else if (sort.price === -1) {
      return b.price - a.price; // Descending order
    }
  };

  if (sort) {
    query = query.sort(sortByPrice);
  }

  const [doc, total] = await Promise.all([query, totalQuery]);

  // Send response
  res.status(200).json({
    status: 'success',
    page,
    limit,
    total,
    data: {
      tripPrograms: doc,
    },
  });
});

exports.GetTripProgram = catchAsync(async (req, res, next) => {
  let query = TripProgram.findById(req.params.id)
    .populate('tour')
    .populate('company');
  const doc = await query;
  if (!doc) return next(new AppError('No document found for that ID', 404));
  res.status(200).json({
    status: 'success',
    data: {
      data: doc,
    },
  });
});

exports.getAllMyTripPrograms = catchAsync(async (req, res, next) => {
  const tripPrograms = await TripProgram.find({ company: req.user._id });
  if (tripPrograms.length === 0)
    return next(new AppError('No tripPrograms found', 404));
  res.status(200).json({
    status: 'success',
    resultLength: tripPrograms.length,
    data: {
      tripPrograms,
    },
  });
});
