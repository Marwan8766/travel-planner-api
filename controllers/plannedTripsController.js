const PlannedTrip = require('../models/plannedTripsModel');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const axios = require('axios');
const geojsonArea = require('geojson-area');
const touristAttractionModel = require('../models/touristAttractionModel');
const tourModel = require('../models/tourModel');
const Tour = require('../models/tourModel');
const Availability = require('../models/availabilityModel');

exports.getPlannedTrips = catchAsync(async (req, res, next) => {
  // find all planned trips
  const plannedTrips = await PlannedTrip.find({ user: req.user._id });
  // if no plannedtrip found return error
  if (plannedTrips.length === 0)
    return next(new AppError('No planned trips was found', 404));

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

// GOOGLE PLACES API
async function searchPlacesByPreferences(
  preferences,
  startDate,
  endDate,
  location
) {
  try {
    const {
      likes_beaches,
      likes_museums,
      likes_nightlife,
      likes_outdoorActivities,
      likes_shopping,
      likes_food,
      likes_sports,
      likes_relaxation,
      likes_familyFriendlyActivities,
    } = preferences;

    const types = [];

    if (likes_beaches) types.push('beach');
    if (likes_museums) types.push('museum');
    if (likes_nightlife) types.push('night_club');
    if (likes_outdoorActivities) types.push('park');
    if (likes_shopping) types.push('shopping_mall');
    if (likes_food) types.push('restaurant');
    if (likes_sports) types.push('stadium');
    if (likes_relaxation) types.push('spa');
    if (likes_familyFriendlyActivities) types.push('amusement_park');

    const apiKey = process.env.GOOGLE_MAPS_API_KEY; // Replace with your Google Places API key

    const baseUrl =
      'https://maps.googleapis.com/maps/api/place/textsearch/json';

    const params = {
      query: location,
      type: types.join('|'),
      key: apiKey,
    };

    const numberOfDays = getNumberOfDays(startDate, endDate);
    const desiredNumberOfPlaces = Math.min(5 * numberOfDays, 70); // Maximum 5 places per day for a maximum of 14 days

    let places = [];
    let nextPageToken = null;

    while (places.length < desiredNumberOfPlaces) {
      if (nextPageToken) {
        params.pagetoken = nextPageToken;
      } else {
        delete params.pagetoken;
      }

      const response = await axios.get(baseUrl, { params });
      const results = response.data.results;
      places = places.concat(results);

      if (response.data.next_page_token) {
        nextPageToken = response.data.next_page_token;
      } else {
        break;
      }
    }

    return places.slice(0, desiredNumberOfPlaces);
  } catch (error) {
    console.error('Error retrieving places from google maps:', error);
    return [];
  }
}

function getNumberOfDays(startDate, endDate) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const timeDiff = Math.abs(end.getTime() - start.getTime());
  const numberOfDays = Math.ceil(timeDiff / (1000 * 3600 * 24));
  return Math.min(numberOfDays, 14);
}

const findMatchingTours = async (location, startDate, endDate) => {
  const locationCoordinates = await getCityRadius(location);
  const numberOfDays = getNumberOfDays(startDate, endDate);
  const desiredNumberOfTours = 3 * numberOfDays;

  const tours = await Tour.find({
    'startLocation.coordinates': {
      $near: {
        $geometry: {
          type: 'Point',
          coordinates: [locationCoordinates.lng, locationCoordinates.lat],
        },
        $maxDistance: locationCoordinates.radius,
      },
    },
  }).limit(desiredNumberOfTours);

  return tours;
};

// Helper function to compare two dates
const areDatesEqual = (date1, date2) => {
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  );
};

// Helper function to generate a random time within a day
const getRandomTime = (date) => {
  const startTime = new Date(date);
  startTime.setHours(Math.floor(Math.random() * 24));
  startTime.setMinutes(Math.floor(Math.random() * 60));
  startTime.setSeconds(0);
  return startTime;
};

const createTripDays = async (
  attractions,
  matchedTours,
  startDate,
  endDate,
  crowdLevel
) => {
  const numberOfDays = getNumberOfDays(startDate, endDate);
  const days = [];

  for (let i = 0; i < numberOfDays; i++) {
    const date = new Date(startDate.getTime() + i * 24 * 60 * 60 * 1000);

    // Filter the matched tours based on availability, available seats, and date
    const filteredTours = await Promise.all(
      matchedTours.map(async (tour) => {
        const availability = await Availability.findOne({
          tour: tour._id,
          date: { $gte: startDate, $lte: endDate },
          availableSeats: { $gte: 1 },
        });
        return availability ? tour : null;
      })
    );

    const dayTours = filteredTours.filter((tour) => tour !== null);
    const timeline = [];

    let maxAttractions;
    let maxTours;

    if (crowdLevel === 'busy') {
      maxAttractions = 6;
      maxTours = 2;
    } else if (crowdLevel === 'moderate') {
      maxAttractions = 4;
      maxTours = 1;
    } else if (crowdLevel === 'quiet') {
      maxAttractions = 1;
      maxTours = 1;
    }

    // Allocate tours with availability to the timeline based on their available dates
    for (const tour of dayTours) {
      const tourAvailability = await Availability.findOne({
        tour: tour._id,
        date: { $gte: startDate, $lte: endDate },
        availableSeats: { $gte: 1 },
      });

      if (tourAvailability && areDatesEqual(tourAvailability.date, date)) {
        timeline.push({
          tour,
          startTime: getRandomTime(date),
          endTime: getRandomTime(date),
        });

        if (timeline.length >= maxTours) {
          break;
        }
      }
    }

    // Allocate attractions to the timeline
    while (
      attractions.length > 0 &&
      timeline.length < maxAttractions &&
      timeline.length < maxTours + maxAttractions
    ) {
      timeline.push({
        attraction: attractions.shift(),
        startTime: getRandomTime(date),
        endTime: getRandomTime(date),
      });
    }

    days.push({ date, timeline });
  }

  return days;
};

exports.createPlannedTrip = catchAsync(async (req, res, next) => {
  const {
    name,
    budget,
    country,
    city,
    startDate,
    endDate,
    preferences,
    crowdLevel,
  } = req.body;

  const location = city ? city : country;

  // get attractions from google maps
  const attractions = await searchPlacesByPreferences(
    preferences,
    startDate,
    endDate,
    location
  );

  // get tours lies in that city or country and try to filter based on prefrences if possible or make it randomly
  const matchedTours = await findMatchingTours(location, startDate, endDate);

  // create days array based on number of days with the timeline and attractions and tours
  const days = await createTripDays(
    attractions,
    matchedTours,
    startDate,
    endDate,
    crowdLevel
  );

  const plannedTrip = await PlannedTrip.create({
    user: req.user._id,
    name,
    budget,
    country,
    city,
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
  const { name } = req.body;

  if (name) plannedTrip.name = name;

  // Update the planned trip and save
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
  const plannedTrip = await PlannedTrip.findOneAndDelete({
    _id: req.params.id,
    user: req.user._id,
  });

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
// exports.addNewDay = catchAsync(async (req, res, next) => {
//   // Find the planned trip
//   const { id } = req.params;
//   const plannedTrip = await PlannedTrip.findById(id);

//   // If not found
//   if (!plannedTrip) {
//     return next(new AppError('Planned trip not found', 404));
//   }

//   // Extract the fields from the request body
//   const { day } = req.body;

//   // Check if day is an object
//   if (typeof day !== 'object' || Array.isArray(day)) {
//     return next(new AppError('Day must be an object', 400));
//   }

//   // Update end date based on number of added days
//   const oneDay = 24 * 60 * 60 * 1000; // One day in milliseconds
//   const endDate = new Date(plannedTrip.endDate.getTime() + oneDay);
//   plannedTrip.endDate = endDate;

//   // make the day date equals to trip end date
//   day.date = plannedTrip.endDate;

//   // Add new day to the planned trip
//   plannedTrip.days.push(day);

//   const savedPlannedTrip = await plannedTrip.save({
//     validateModifiedOnly: true,
//   });

//   // Send response
//   res.status(201).json({
//     status: 'success',
//     plannedTrip: savedPlannedTrip,
//   });
// });

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
    timeline.attraction = attraction; // needs to implement search for attractions functionality
  }

  if (tour) {
    timeline.tour = tour;
  }

  if (customActivity) {
    timeline.customActivity = customActivity;
  }

  const updatedPlannedTrip = await plannedTrip.save({
    validateModifiedOnly: true,
  });

  res.status(200).json({
    status: 'success',
    data: {
      updatedPlannedTrip,
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

  const updatedPlannedTrip = await plannedTrip.save({
    validateModifiedOnly: true,
  });

  res.status(201).json({
    status: 'success',
    data: {
      updatedPlannedTrip,
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
    const radiusInRadians = radius / 6371000;

    return {
      radius: radiusInRadians,
      lat,
      lng: lon,
    };
  } catch (error) {
    throw new Error(`Failed to retrieve city radius: ${error.message}`);
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
