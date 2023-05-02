const AppError = require('../utils/appError');
const catchAsync = require('../utils/catchAsync');
const Country = require('../models/countryModel');
const City = require('../models/cityModel');
const TouristAttraction = require('../models/touristAttractionModel');

exports.createTouristAttractions = catchAsync(async (req, res, next) => {
  const { cityId, attractions = [] } = req.body;

  // Filter out duplicate attractions based on the 'name' field
  const uniqueAttractions = attractions.reduce(
    (acc, attraction) => {
      if (!acc.hashMap[attraction.name]) {
        acc.hashMap[attraction.name] = true;
        acc.arr.push(attraction);
      }
      return acc;
    },
    { hashMap: {}, arr: [] }
  ).arr;

  if (uniqueAttractions.length === 0)
    return next(new AppError('No attractions were provided.', '400'));

  // Create an array of TouristAttraction documents
  const touristAttractionsDocs = uniqueAttractions.map((attraction) => {
    return {
      name: attraction.name,
      link: attraction.link,
      rating: attraction.rating,
      type: attraction.type,
      description: attraction.description,
      image: attraction.image,
      open_close_times: attraction.open_close_times,
      city: cityId,
    };
  });

  // Create the TouristAttraction documents in bulk using createMany
  const savedAttractions = await TouristAttraction.create(
    touristAttractionsDocs
  );

  // Return the saved attractions and the number of new attractions that were saved
  res.status(201).json({
    status: 'success',
    message: `Saved ${savedAttractions.length} new attractions.`,
    attractions: savedAttractions,
  });
});

exports.getAllAttractionsInCity = catchAsync(async (req, res, next) => {
  const { cityId } = req.body;

  if (!cityId) return next(new AppError('cityId isnot provided', 400));

  const touristAttractions = await TouristAttraction.find({ city: cityId });

  if (touristAttractions.length === 0)
    return next(
      new AppError('There is no attractions found in that city', 404)
    );

  res.status(200).json({
    status: 'success',
    length: touristAttractions.length,
    data: {
      attractions: touristAttractions,
    },
  });
});
