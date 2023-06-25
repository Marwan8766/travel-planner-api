const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const Tour = require('../models/tourModel');
const plannedTripController = require('./plannedTripsController');
const { query } = require('express');
const axios = require('axios');
const { options } = require('../app');
const { json } = require('body-parser');

exports.chatbotWebhookHandler = catchAsync(async (req, res, next) => {
  const {
    Location,
    budget,
    Date_period,
    // flight
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

    case 'flights':
      console.log(`flights intent`);
      if (!cityNamePickup) textResponse = constructTextResNoCityFlights();
      else if (!cityNameDestination)
        textResponse = constructTextResNoCityFlights();
      else
        textResponse = await handleFlightsIntent(
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
        );
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
    // console.log(`response: ${response.toString()}`);
    // console.log(`response.data: ${response.data.toString()}`);
    const airportCode = response.data.data[0].airportCode;
    console.log(`airportcode: ${airportCode}`);

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
        itineraryType: flightType,
        sortOrder: sortingOrder,
        numAdults,
        numSeniors: numOfSeniors.toString(), //  gte 65
        classOfService: flightClass,
        pageNumber: '1',
        nearby: nearbyAirPorts, // optional
        nonstop: nonstopFlight, // optional
        currencyCode: 'USD',
        returnDate,
      },
      headers: {
        'X-RapidAPI-Key': process.env.TRIPADVISOR_API_KEY,
        'X-RapidAPI-Host': 'tripadvisor16.p.rapidapi.com',
      },
    };

    const response = await axios.request(options);

    console.log(response.data.data);
    // console.log('responseOFFlights: ', JSON.stringify(response));
    const flights = response.data.data.flights;
    // console.log(`res.data:  ${JSON.stringify(response.data.data)}`);

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

const validateFlightParams = (
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
  // validate departureDate
  if (!departureDate)
    return (text = `Please provide a departure date in the form year-month-day`);
  if (
    !isValidDateFormat(departureDate) &&
    new Date(departureDate) <= Date.now()
  )
    return (text = `Please provide a valid and correct format of departure date`);

  // validate sortingOrder
  if (!sortingOrder)
    return (text =
      'Please provide a sorting order either ML_BEST_VALUE or PRICE');
  if (sortingOrder !== 'ML_BEST_VALUE' && sortingOrder !== 'PRICE')
    return (text = `Please provide correct sorting order either ML_BEST_VALUE or PRICE,  the provided sorting order ${sortingOrder} isn't valid`);

  // validate numAdults
  if (!numAdults)
    return (text =
      'Please provide the number of adults ages between 18-64 years');
  if (!Number(numAdults))
    // check if it isnot a number
    return (text = 'Please provide a correct number of adults');

  // validate numOfSeniors
  if (!numOfSeniors)
    return (text = 'Please provide the number of seniors (65 years or above)');
  if (!Number(numOfSeniors))
    return (text = 'Please provide a correct number of seniors');

  // validate flightClass
  if (!flightClass)
    return (text =
      'Please provide the flight class either ECONOMY or PREMIUM_ECONOMY or BUSINESS or  FIRST');
  if (
    flightClass !== 'ECONOMY' &&
    flightClass !== 'PREMIUM_ECONOMY' &&
    flightClass !== 'BUSINESS' &&
    flightClass !== 'FIRST'
  )
    return (text = `Please provide a valid flight class either ECONOMY or PREMIUM_ECONOMY or BUSINESS or  FIRST,  the provided class ${flightClass} isnot valid`);

  // validate nearbyAirPorts
  if (!nearbyAirPorts)
    return (text =
      'Please provide if you want to include nearby airports or not');
  if (nearbyAirPorts !== 'yes' && nearbyAirPorts !== 'no')
    return (text =
      'Please provide a valid answer if you want to include nearby airports or not');

  // validate nonstopFlight
  if (!nonstopFlight)
    return (text = 'Please provide if you want a nonstop flight or not');
  if (nonstopFlight !== 'yes' && nonstopFlight !== 'no')
    return (text =
      'Please provide a valid answer if you want a nonstop flight or not');

  // validate flight type
  if (!flightType)
    return (text =
      'Please provide a flight type either ONE_WAY or ROUND_TRIP and if you choose ROUND_TRIP please provide the return date');
  if (flightType !== 'ONE_WAY' && flightType !== 'ROUND_TRIP')
    return (text = `Please provide correct flight type either ONE_WAY or ROUND_TRIP, the provided flight type ${flightType} isn't correct`);

  // validate returnDate
  if (flightType === 'ROUND_TRIP') {
    if (!returnDate)
      return (text =
        'Please provide the return date in the form year-month-day');
    if (!isValidDateFormat(returnDate) && returnDate <= departureDate)
      return (text =
        'Please provide a valid and correct format of return date');
  }

  // if everthing is ok retrun 'correct'
  return 'correct';
};

const constructFlightText = (flights) => {
  const flightDetails = flights.map((flight, index) => {
    const { segments, purchaseLinks } = flight;
    const departureDateTime = segments[0].legs[0].departureDateTime;
    const arrivalDateTime =
      segments[segments.length - 1].legs[0].arrivalDateTime;
    const airline = segments[0].legs[0].operatingCarrier.displayName;
    const price = purchaseLinks[index].totalPrice;

    return {
      departureDateTime,
      arrivalDateTime,
      airline,
      price,
    };
  });

  // Creating a nicely formatted text
  let text = '';
  flightDetails.forEach((flight, index) => {
    text += `Flight ${index + 1}:\n`;
    text += `• Airline: ${flight.airline}\n`;
    text += `• Departure: ${flight.departureDateTime}\n`;
    text += `• Arrival: ${flight.arrivalDateTime}\n`;
    text += `• Price: ${flight.price} INR\n\n`;
  });

  // retrun the text
  return text;
};

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

  // validate params
  text = validateFlightParams(
    departureDate,
    flightType,
    sortingOrder,
    numAdults,
    numOfSeniors,
    flightClass,
    nearbyAirPorts,
    nonstopFlight,
    returnDate
  );

  // if there is an error return the text else continue
  if (text !== 'correct') return text;

  ///////////////////////////////////////////////////

  // if everything is ok call the function to find the flights
  const flights = await searchFlights(
    pickupAirportCode,
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
  );

  // generate the text of this data
  text = constructFlightText(flights);

  // return the final text
  return text;
};

const constructTextResNoCityFlights = () => {
  return `
  To find flights, please provide the following information:
  
  1. Departure city: [cityNamePickup]
  2. Destination city: [cityNameDestination]
  3. Departure date (in the format year-month-day): [departureDate]
  4. Flight type (ONE_WAY or ROUND_TRIP): [flightType]
  5. Sorting order (ML_BEST_VALUE or PRICE): [sortingOrder]
  6. Number of adults (ages between 18-64 years): [numAdults]
  7. Number of seniors (65 years or above): [numOfSeniors]
  8. Flight class (ECONOMY, PREMIUM_ECONOMY, BUSINESS, or FIRST): [flightClass]
  9. Include nearby airports (yes or no): [nearbyAirPorts]
  10. Nonstop flight only (yes or no): [nonstopFlight]
  11. Return date (in the format year-month-day, required for ROUND_TRIP): [returnDate]
  
  Please provide the requested information with their respective values. Thank you!
  `;
};
