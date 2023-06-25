const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const Tour = require('../models/tourModel');
const plannedTripController = require('./plannedTripsController');
const { query } = require('express');
const axios = require('axios');
const { options } = require('../app');

exports.chatbotWebhookHandler = catchAsync(async (req, res, next) => {
  const {
    Location,
    budget,
    Date_period,
    cityNamePickup, // flight
    cityNameDestination,
    departureDate,
    flightType,
    sortingOrder,
    numAdults,
    numOfSeniors,
    flightClass,
    nearbyAirPorts,
    nonstopFlight,
    returnDate,
  } = req.body.queryResult.parameters;

  // Extract the location
  let location = '';
  if (Location && Location.city) {
    location = Location.city;
  } else if (Location && Location.country) {
    location = Location.country;
  }

  console.log(`location: ${location}`);
  console.log(`budget: ${budget}`);
  console.log(`Date_period: ${Date_period}`);
  console.log(`req.body: ${JSON.stringify(req.body)}`);

  // Extract the intent display name
  const intentDisplayName = req.body.queryResult.intent.displayName;

  // initialize the text response to be send
  let textResponse = '';

  switch (intentDisplayName) {
    case 'tours':
      console.log(`tours intent`);
      if (!location) textResponse = 'Please provide the location';
      else if (!budget) textResponse = 'Please provide your budget';
      else textResponse = await handleToursIntent(location, budget);
      break;

    case 'recommend':
      console.log(`recommend intent`);
      if (!location) textResponse = 'Please provide the location';
      else if (!Date_period)
        textResponse = 'Please provide the period of the trip';
      else
        textResponse = await handleRecommendationIntent(location, Date_period);
      break;

    default:
      console.log(`intent not found`);
      textResponse = "this intent can't be found";
      break;
  }

  console.log(`textResponse: ${textResponse}`);
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
  console.log(`lat:${lat}   lng: ${lng},  radius: ${radius}`);

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

  const matchedTours = await Tour.find(filter).limit(toursLength);

  if (matchedTours.length === 0) {
    // No tours found, return null
    return [];
  }

  return matchedTours;
};

const createMessageTour = (matchedTours) => {
  let message = '';

  if (matchedTours.length === 0) {
    return 'No tours found for this location and budget';
  }

  matchedTours.forEach((tour, index) => {
    const { name, price } = tour;
    message += `\u2022 Tour ${index + 1}:\n`;
    message += `   Name: ${name}\n`;
    message += `   Price: $${price}\n\n`;
  });

  return message;
};

const constructQueryTour = async (location, budget) => {
  let query = {};

  // if there is location find the lat , lng , radius and add to query object
  if (location) {
    const coordinatesRes = await plannedTripController.getCityRadius(location);
    query = { ...coordinatesRes };
    console.log(query);
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
  let message = '';

  plan.forEach((day) => {
    message += `Day ${day.day}:\n`;

    day.activities.forEach((activity) => {
      message += `\u2022 ${activity.time}: ${activity.description}\n`;
    });

    message += '\n';
  });

  return message;
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

/////////////////////////////////////////////////////////////////////////////
// FLIGHTS

const getAirportCode = async (cityName) => {
  try {
    const options = {
      method: 'GET',
      url: 'https://tripadvisor16.p.rapidapi.com/api/v1/flights/searchAirport',
      params: { query: cityName },
      headers: {
        'X-RapidAPI-Key': process.env.TRIPADVISOR_API_KEY,
        'X-RapidAPI-Host': 'tripadvisor16.p.rapidapi.com',
      },
    };

    const response = await axios.request(options);
    const airportCode = response.data.data[0].airportCode;

    return airportCode;
  } catch (error) {
    console.error(error);
    return null;
  }
};

const searchFlights = async (
  sourceAirportCode,
  destinationAirportCode,
  departureDate,
  flightType,
  sortingOrder,
  numAdults,
  numOfSeniors,
  flightClass,
  nearbyAirPorts,
  nonstopFlight,
  returnDate
) => {
  try {
    const options = {
      method: 'GET',
      url: 'https://tripadvisor16.p.rapidapi.com/api/v1/flights/searchFlights',
      params: {
        sourceAirportCode,
        destinationAirportCode,
        date: departureDate, //'2023-06-25',
        itineraryType: flightType || 'ONE_WAY', //'ONE_WAY',
        sortOrder: sortingOrder || 'ML_BEST_VALUE',
        numAdults,
        numSeniors: numOfSeniors.toString() || '0', //  gte 65
        classOfService: flightClass || 'ECONOMY',
        pageNumber: '1',
        nearby: nearbyAirPorts || 'yes', // optional
        nonstop: nonstopFlight || 'no', // optional
        currencyCode: 'USD',
      },
      headers: {
        'X-RapidAPI-Key': process.env.TRIPADVISOR_API_KEY,
        'X-RapidAPI-Host': 'tripadvisor16.p.rapidapi.com',
      },
    };

    if (returnDate) options.params.returnDate = returnDate;

    const response = await axios.request(options);
    const flights = response.data.data.flights;

    console.log(`flights length: ${flights.length}`);

    return flights;
  } catch (error) {
    console.error(`error in finding flights: ${error}`);
    return [];
  }
};

function isValidDateFormat(dateString) {
  const regex = /^\d{4}-\d{2}-\d{2}$/;
  return regex.test(dateString);
}

const handleFlightsIntent = async (
  cityNamePickup,
  cityNameDestination,
  departureDate,
  flightType,
  sortingOrder,
  numAdults,
  numOfSeniors,
  flightClass,
  nearbyAirPorts,
  nonstopFlight,
  returnDate
) => {
  let text = '';

  // find the pickup airport code
  const pickupAirportCode = await getAirportCode(cityNamePickup);
  if (!pickupAirportCode)
    return (text = `Please provide the pickup city name correctly this pickup city name ${cityNamePickup} isnot correct`);

  // find the destination airport code
  const destinationAirportCode = await getAirportCode(cityNameDestination);
  if (!destinationAirportCode)
    return (text = `Please provide the destination city name correctly this destination city name ${cityNameDestination} isnot correct`);

  // validate departureDate
  if (!departureDate) return (text = `Please provide a departure date`);
  if (!isValidDateFormat(departureDate))
    return (text = `Please provide a correct format of departure date`);

  // validate flight type
  if (!flightType) return (text = 'Please provide a flight type');
  if (flightType !== '' || flightType !== '')
    return (text = 'Please provide correct flight type');
};
