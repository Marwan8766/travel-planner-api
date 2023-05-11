const PlannedTrip = require('../models/plannedTripsModel');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const axios = require('axios');
const geojsonArea = require('geojson-area');
const touristAttractionModel = require('../models/touristAttractionModel');
const tourModel = require('../models/tourModel');

exports.getPlannedTrips = catchAsync(async (req, res, next) => {
  const plannedTrips = await PlannedTrip.find({ user: req.user._id });
  res.status(200).json({
    status: 'success',
    plannedTrips,
    length: plannedTrips.length,
  });
});

exports.getPlannedTripById = catchAsync(async (req, res, next) => {
  const plannedTrip = await PlannedTrip.findOne({
    _id: req.params.id,
    user: req.user._id,
  });
  if (!plannedTrip) {
    return next(new AppError('Planned trip not found', 404));
  }
  res.status(200).json({
    status: 'success',
    plannedTrip,
  });
});

exports.createPlannedTrip = catchAsync(async (req, res, next) => {
  const {
    name,
    budget,
    country,
    cities,
    startDate,
    endDate,
    preferences,
    crowdLevel,
    days,
  } = req.body;

  const plannedTrip = await PlannedTrip.create({
    user: req.user._id,
    name,
    budget,
    country,
    cities,
    startDate,
    endDate,
    preferences,
    crowdLevel,
    days,
  });

  res.status(201).json({
    status: 'success',
    plannedTrip,
  });
});

exports.updatePlannedTrip = catchAsync(async (req, res, next) => {
  // Find the planned trip by ID
  const plannedTrip = await PlannedTrip.findById(req.params.id);

  // If the planned trip is not found, return an error
  if (!plannedTrip) {
    return next(new AppError('Planned trip not found', 404));
  }

  // Update the planned trip fields using object destructuring
  const {
    name,
    budget,
    country,
    cities,
    startDate,
    endDate,
    preferences,
    crowdLevel,
    days,
  } = req.body;

  // Create an object with only the fields that are provided in the req.body
  const updatedPlannedTrip = {};
  if (name) updatedPlannedTrip.name = name;
  if (budget) updatedPlannedTrip.budget = budget;
  if (country) updatedPlannedTrip.country = country;
  if (cities) updatedPlannedTrip.cities = cities;
  if (startDate) updatedPlannedTrip.startDate = startDate;
  if (endDate) updatedPlannedTrip.endDate = endDate;
  if (preferences) updatedPlannedTrip.preferences = preferences;
  if (crowdLevel) updatedPlannedTrip.crowdLevel = crowdLevel;
  if (days) updatedPlannedTrip.days = days;

  // Update the planned trip and save
  plannedTrip.set(updatedPlannedTrip);
  const savedPlannedTrip = await plannedTrip.save({
    validateModifiedOnly: true,
  });

  // Return the updated planned trip
  res.status(200).json({
    status: 'success',
    plannedTrip: savedPlannedTrip,
  });
});

exports.deletePlannedTrip = catchAsync(async (req, res, next) => {
  // Find the planned trip by ID
  const plannedTrip = await PlannedTrip.findByIdAndDelete(req.params.id);

  // If the planned trip is not found, return an error
  if (!plannedTrip) {
    return next(new AppError('Planned trip not found', 404));
  }

  // Return success message
  res.status(204).json({
    status: 'success',
    message: 'Planned trip deleted successfully',
  });
});
exports.addNewDay = catchAsync(async (req, res, next) => {
  // Find the planned trip
  const { id } = req.params;
  const plannedTrip = await PlannedTrip.findById(id);

  // If not found
  if (!plannedTrip) {
    return next(new AppError('Planned trip not found', 404));
  }

  // Extract the fields from the request body
  const { day } = req.body;

  // Check if day is an object
  if (typeof day !== 'object' || Array.isArray(day)) {
    return next(new AppError('Day must be an object', 400));
  }

  // Update end date based on number of added days
  const oneDay = 24 * 60 * 60 * 1000; // One day in milliseconds
  const endDate = new Date(plannedTrip.endDate.getTime() + oneDay);
  plannedTrip.endDate = endDate;

  // make the day date equals to trip end date
  day.date = plannedTrip.endDate;

  // Add new day to the planned trip
  plannedTrip.days.push(day);

  const savedPlannedTrip = await plannedTrip.save({
    validateModifiedOnly: true,
  });

  // Send response
  res.status(201).json({
    status: 'success',
    plannedTrip: savedPlannedTrip,
  });
});

exports.updateTimelineItem = catchAsync(async (req, res, next) => {
  const { id, dayIndex, timelineIndex } = req.params;
  const { startTime, endTime, attraction, tour, customActivity } = req.body;

  const plannedTrip = await PlannedTrip.findById(id);
  const timeline = plannedTrip.days[dayIndex].timeline[timelineIndex];

  if (!timeline) {
    return next(new AppError('Invalid timeline index', 400));
  }

  if (startTime) {
    timeline.startTime = new Date(startTime);
  }

  if (endTime) {
    timeline.endTime = new Date(endTime);
  }

  if (attraction) {
    timeline.attraction = attraction;
  }

  if (tour) {
    timeline.tour = tour;
  }

  if (customActivity) {
    timeline.customActivity = customActivity;
  }

  await plannedTrip.save({ validateModifiedOnly: true });

  res.status(200).json({
    status: 'success',
    data: {
      plannedTrip,
    },
  });
});

exports.deleteTimelineItem = catchAsync(async (req, res, next) => {
  const { id, dayIndex, timelineIndex } = req.params;

  const plannedTrip = await PlannedTrip.findById(id);
  const timeline = plannedTrip.days[dayIndex].timeline[timelineIndex];

  if (!timeline) {
    return next(new AppError('Invalid timeline index', 400));
  }

  plannedTrip.days[dayIndex].timeline.splice(timelineIndex, 1);

  await plannedTrip.save({ validateModifiedOnly: true });

  res.status(204).json({
    status: 'success',
    data: null,
  });
});

exports.addCustomActivity = catchAsync(async (req, res, next) => {
  const { id, dayIndex } = req.params;
  const { customActivity, startTime, endTime } = req.body;

  const plannedTrip = await PlannedTrip.findById(id);

  if (!plannedTrip) {
    return next(new AppError('Planned trip not found', 404));
  }

  plannedTrip.days[dayIndex].timeline.push({
    customActivity,
    startTime,
    endTime,
  });

  await plannedTrip.save({ validateModifiedOnly: true });

  res.status(201).json({
    status: 'success',
    data: {
      plannedTrip,
    },
  });
});

exports.getCityRadius = async function (cityName) {
  try {
    // Fetch the city boundary from OpenStreetMap
    const response = await axios.get(
      `https://nominatim.openstreetmap.org/search?q=${cityName}&format=json&limit=1`
    );

    const { lat, lon, osm_id } = response.data[0];
    const cityBoundaryResponse = await axios.get(
      `https://nominatim.openstreetmap.org/reverse?format=json&osm_type=R&osm_id=${osm_id}&polygon_geojson=1`
    );

    // Calculate the area of the city boundary polygon
    const cityBoundary = cityBoundaryResponse.data.geojson;
    const area = geojsonArea.geometry(cityBoundary);

    // Calculate the radius of a circle with the same area as the city boundary polygon
    const radius = Math.sqrt(area / Math.PI);

    // Convert radius to radians
    const radiusInRadians = radius / 6371;

    return {
      radius: radiusInRadians,
      lat,
      lng: lon,
    };
  } catch (error) {
    console.error(error);
  }
};

exports.getAttractionsWithinCity = async function (cityName) {
  try {
    const cityObj = await getCityRadius(cityName);
    const { lat, lng, radius } = cityObj;
    const touristAttractions = await touristAttractionModel.find({
      location: { $geoWithin: { $centerSphere: [[lng, lat], radius] } },
    });
    return touristAttractions;
  } catch (err) {
    console.error(err);
  }
};

exports.getToursWithinCity = async function (cityName) {
  try {
    const cityObj = await getCityRadius(cityName);
    const { lat, lng, radius } = cityObj;
    const tours = await tourModel.find({
      startLocation: { $geoWithin: { $centerSphere: [[lng, lat], radius] } },
    });
    return tours;
  } catch (err) {
    console.error(err);
  }
};

exports.recommendPlannedTrip = catchAsync(async (req, res, next) => {});
