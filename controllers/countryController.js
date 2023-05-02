const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const City = require('../models/cityModel');
const Country = require('../models/countryModel');

exports.createCountry = catchAsync(async (req, res, next) => {
  // take the data from the req body
  const { name, continent, language, currency, cityId } = req.body;

  //  create a new country
  const country = await Country.create({
    name,
    continent,
    language,
    currency,
    cities: [cityId], // Reference to the City document's _id in an array
  });

  res.status(201).json({
    status: 'success',
    country,
  });
});

// Get all cities
exports.getAllCountries = catchAsync(async (req, res, next) => {
  // find all countries
  const countries = await Country.find();

  // if no countries return error
  if (countries.length === 0)
    return next(new AppError('There is no countries found', 404));

  res.status(200).json({
    status: 'success',
    results: countries.length,
    data: {
      countries,
    },
  });
});

// Get a country by ID
exports.getCountry = catchAsync(async (req, res, next) => {
  const country = await Country.findById(req.params.countryId);
  if (!country) return next(new AppError('Country not found', 404));
  res.status(200).json({
    status: 'success',
    data: {
      country,
    },
  });
});

// Delete a country by ID (only accessible to admins)
exports.deleteCountry = catchAsync(async (req, res, next) => {
  const deletedCountry = await Country.findByIdAndDelete(req.params.countryId);
  if (!deletedCountry) return next(new AppError('Country not found', 404));
  res.status(204).json({
    status: 'success',
    data: null,
  });
});

// Update a country by ID (only accessible to admins)
exports.updateCountry = catchAsync(async (req, res, next) => {
  const { name, continent, language, currency } = req.body;
  const country = await Country.findById(req.params.countryId);
  if (!country) return next(new AppError('Country not found', 404));

  country.name = name ? name : country.name;
  country.continent = continent ? continent : country.continent;
  country.language = language ? language : country.language;
  country.currency = currency ? currency : country.currency;

  const updatedCountry = await country.save({ validateModifiedOnly: true });
  if (!updatedCountry)
    return next(new AppError('Error updating the country', 400));

  res.status(200).json({
    status: 'success',
    data: {
      country,
    },
  });
});

exports.getAllCountryCities = catchAsync(async (req, res, next) => {
  const { countryId } = req.params;
  const country = await Country.findById(countryId).populate('cities');

  if (!country) return next(new AppError('Country not found', 404));

  res.status(200).json({
    status: 'success',
    length: country.cities.length,
    data: {
      cities: country.cities,
    },
  });
});
