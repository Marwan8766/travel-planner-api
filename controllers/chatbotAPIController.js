const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const Tour = require('../models/tourModel');
const plannedTripController = require('./plannedTripsController');
const { query } = require('express');
const axios = require('axios');

exports.chatbotWebhookHandler = catchAsync(async (req, res, next) => {
  const { location, budget, Date_period } = req.body.queryResult.parameters;
  // Extract the intent display name
  const intentDisplayName = req.body.queryResult.intent.displayName;

  // initialize the text response to be send
  let textResponse = '';

  switch (intentDisplayName) {
    case 'tours':
      textResponse = await handleToursIntent(location, budget);
      break;

    case 'recommend':
      if (location && Date_period)
        textResponse = await handleRecommendationIntent(location, Date_period);
      else
        textResponse =
          'Please provide the location and period to plan the trip';
      break;

    default:
      textResponse = "this intent can't be found";
      break;
  }

  // send the res with the textResponse
  res.status(200).json({
    fulfillmentMessages: [
      {
        text: {
          text: [textResponse],
        },
      },
    ],
  });
});

/////////////////////////////////////////////////////////////////////////

const findTopMatchedTours = async (query, toursLength = 5) => {
  const { lat, lng, radius, budget } = query;

  const filter = {
    ...(lat && lng && radius
      ? {
          'startLocations.coordinates': {
            $geoWithin: { $centerSphere: [[lng, lat], radius] },
          },
        }
      : {}),
    ...(budget ? { price: { $lte: budget } } : {}),
  };

  const matchedTours = await Tour.find(filter).limit(toursLength).cache(false);

  if (matchedTours.length === 0) {
    // No tours found, return null
    return [];
  }

  return matchedTours;
};

const createMessageTour = (matchedTours) => {
  let tourText = '';

  if (matchedTours.length === 0)
    return 'No tours found for this location and budget';

  matchedTours.forEach((tour, index) => {
    const { name, price } = tour;
    tourText += `Tour ${index + 1}:
Name: ${name}
Price: $${price}\n\n`;
  });

  return tourText;
};

const constructQueryTour = async (location, budget) => {
  let query;

  // if there is location find the lat , lng , radius and add to query object
  if (location) {
    const coordinatesRes = await plannedTripController.getCityRadius(location);
    query = { ...coordinatesRes };
  }

  // if there is budget add to query obj
  if (budget) query.budget = budget;

  // return the query obj
  return query;
};

const handleToursIntent = async (location, budget) => {
  // construct the query obj
  const query = await constructQueryTour(location, budget);

  // find top 5 matched tours with the query
  const matchedTours = await findTopMatchedTours(query, 5);

  // create text message
  const textMessage = createMessageTour(matchedTours);

  // return text message
  return textMessage;
};

////////////////////////////////////////////////////////////

const createMessageRecommendedTrip = (plan) => {
  let text = '';

  plan.forEach((day) => {
    text += `Day ${day.day}:\n`;

    day.activities.forEach((activity) => {
      text += `${activity.time} - ${activity.description}\n`;
    });

    text += '\n';
  });

  return text;
};

const getTravelPlannerRapidApiRes = async (location, Date_period) => {
  const options = {
    method: 'GET',
    url: 'https://ai-trip-planner.p.rapidapi.com/',
    params: {
      days: Date_period,
      destination: location,
    },
    headers: {
      'X-RapidAPI-Key': process.env.TRAVEL_PLANNER_RAPID_API_KEY,
      'X-RapidAPI-Host': 'ai-trip-planner.p.rapidapi.com',
    },
  };

  try {
    const response = await axios.request(options);
    console.log(response.data);
    return response;
  } catch (error) {
    console.error(error);
  }
};

const handleRecommendationIntent = async (location, Date_period) => {
  // send req to rapid API travel planner and save the res
  const response = await getTravelPlannerRapidApiRes(location, Date_period);

  // get the plan array
  const { data } = response;

  console.log(data);
  // create and return text message
  return createMessageRecommendedTrip(data.plan);
};
