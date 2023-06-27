const Tour = require('../models/tourModel');
const plannedTripController = require('./plannedTripsController');
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

exports.getAllTours = catchAsync(async (req, res, next) => {
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
  // Sort by price in ascending or descending order
  let sort;
  if (req.query.sort === 'asc') {
    sort = { price: 1 }; // ascending order
  } else if (req.query.sort === 'desc') {
    sort = { price: -1 }; // descending order
  }

  let query = await Tour.find(priceFilter)
    .populate('company')
    .skip(skip)
    .limit(limit);

  console.log(`query length: ${query.length}`);

  let totalQuery = await Tour.countDocuments(priceFilter);

  console.log(`totalQuery: ${totalQuery}`);

  if (req.query.cityName) {
    const cityName = req.query.cityName;
    const { radius, lat, lng } = await plannedTripController.getCityRadius(
      cityName
    );

    console.log(`radius: ${radius}  lat: ${lat}  lng: ${lng}`);

    query = await Tour.find({
      'startLocations.coordinates': {
        $geoWithin: {
          $centerSphere: [[lng, lat], radius],
        },
      },
    });

    console.log(`query after geowithin length: ${query}`);

    totalQuery = await Tour.find({
      'startLocations.coordinates': {
        $geoWithin: {
          $centerSphere: [[lng, lat], radius],
        },
      },
    });
  }

  console.log(`total query length: ${totalQuery.length}`);

  if (sort) {
    query = query.sort(sort);
  }

  const [doc, total] = await Promise.all([query, totalQuery]);

  console.log(`doc: ${console.log(doc.length)}`);

  // Send response
  res.status(200).json({
    status: 'success',
    page,
    limit,
    total,
    data: {
      tours: doc,
    },
  });
});

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
