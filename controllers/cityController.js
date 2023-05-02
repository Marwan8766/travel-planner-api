const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const City = require('../models/cityModel');
const Country = require('../models/countryModel');

exports.createCity = catchAsync(async (req, res, next) => {
  // take the data from the req body
  const { name, countryId } = req.body;

  // find the country
  const country = await Country.findOne({ _id: countryId });

  // if not found return error
  if (!country) return next(new AppError('Country not found', 404));

  //  create a new city
  const city = await City.create({ name });

  // update with the ref of the city
  country.cities.push(city._id);

  // save the country
  await country.save({ validateModifiedOnly: true });

  res.status(201).json({
    status: 'success',
    city,
  });
});

// Get all cities
exports.getAllCities = catchAsync(async (req, res, next) => {
  // find all cities
  const cities = await City.find();

  // if no cities return error
  if (cities.length === 0)
    return next(new AppError('There is no cities found', 404));

  res.status(200).json({
    status: 'success',
    results: cities.length,
    data: {
      cities,
    },
  });
});

// Get a city by ID
exports.getCity = catchAsync(async (req, res, next) => {
  const city = await City.findById(req.params.cityId);
  if (!city) return next(new AppError('City doesnot exist', 404));
  res.status(200).json({
    status: 'success',
    data: {
      city,
    },
  });
});

////////////////////////////////
///////////////////////////////////
////////////////////////////////////
// Delete a city by ID (only accessible to admins)
exports.deleteCity = catchAsync(async (req, res, next) => {
  const { cityId } = req.body;

  const deletedCity = await City.findByIdAndDelete(cityId);
  if (!deletedCity) return next(new AppError('City not found', 404));

  // delete city from country cities

  // Find the parent country of the deleted city
  const parentCountry = await Country.findOne({ cities: { $in: [cityId] } });

  if (!parentCountry) {
    return next(new AppError('Parent country not found', 404));
  }

  // Remove the deleted city's reference from the parent country's cities array
  parentCountry.cities.pull(cityId);

  // Save the updated parent country document
  await parentCountry.save({ validateModifiedOnly: true });

  // Delete attractions in the deleted city
  const deletedAttractions = await TouristAttraction.deleteMany({
    city: cityId,
  });

  res.status(204).json({
    status: 'success',
    data: null,
  });
});
///////////////////////////////////////
////////////////////////////////////////
//////////////////////////////////////////

// Update a city by ID (only accessible to admins)
exports.updateCity = catchAsync(async (req, res, next) => {
  const { name } = req.body;
  const city = await City.findById(req.params.cityId);
  if (!city) return next(new AppError('City not found', 404));

  city.name = name ? name : city.name;
  const updatedCity = await city.save({ validateModifiedOnly: true });
  if (!updatedCity) return next(new AppError('Error updating the city', 400));
  res.status(200).json({
    status: 'success',
    data: {
      city,
    },
  });
});
