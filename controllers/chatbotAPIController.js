const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const Tour = require('../models/tourModel');
const plannedTripController = require('./plannedTripsController');
const { query } = require('express');
const axios = require('axios');
const { options } = require('../app');
const { json } = require('body-parser');
const Chatbot = require('../models/chatbotModel');

exports.chatbotWebhookHandler = catchAsync(async (req, res, next) => {
  let {
    Location,
    budget,
    Date_period,
    // flight
    cityNamePickup,
    cityNameDestination,
    departureDate,
    flightType,
    // sortingOrder,
    numAdults,
    numOfSeniors,
    flightClass,
    nearbyAirPorts,
    nonstopFlight,
    returnDate,
    // hotels
    hotelCity,
    checkInDate,
    checkOutDate,
    adults,
    rooms,
    // Attractions
    preference,
  } = req.body.queryResult.parameters;

  const sessionId = req.body.session;

  if (departureDate && departureDate.length > 0)
    departureDate = extractDate(departureDate);
  if (returnDate && returnDate.length > 0) returnDate = extractDate(returnDate);
  if (checkInDate && checkInDate.length > 0)
    checkInDate = extractDate(checkInDate);
  if (checkOutDate && checkOutDate.length > 0)
    checkOutDate = extractDate(checkOutDate);

  // Extract the location
  let location = '';
  if (Location && Location.city) {
    location = Location.city;
  } else if (Location && Location.country) {
    location = Location.country;
  }
  if (!location) location = Location;

  console.log(`locationFirstParameter: ${location}`);

  // console.log(`location: ${location}`);
  // console.log(`budget: ${budget}`);
  // console.log(`Date_period: ${Date_period}`);
  console.log(`req.body: ${JSON.stringify(req.body)}`);

  // Extract the intent display name
  const intentDisplayName = req.body.queryResult.intent.displayName;

  // initialize the text response to be send
  let textResponse = '';

  switch (intentDisplayName) {
    case 'tours':
      // console.log(`tours intent`);
      if (!location) textResponse = 'Please provide the location';
      else if (!budget) textResponse = 'Please provide your budget';
      else textResponse = await handleToursIntent(location, budget);
      break;

    case 'recommend':
      // console.log(`recommend intent`);
      if (!location) textResponse = 'Please provide the location';
      else if (!Date_period)
        textResponse = 'Please provide the period of the trip';
      else
        textResponse = await handleRecommendationIntent(location, Date_period);
      break;

    case 'flights':
      // console.log(`flights intent`);
      // console.log(`departureDate: ${departureDate}`);
      // if (!cityNamePickup) textResponse = constructTextResNoCityFlights();
      // else if (!cityNameDestination)
      //   textResponse = constructTextResNoCityFlights();
      // else
      nonstopFlight = 'no';
      nearbyAirPorts = 'yes';
      textResponse = await handleFlightsIntent(
        cityNamePickup,
        cityNameDestination,
        departureDate,
        flightType,
        // sortingOrder,
        numAdults,
        numOfSeniors,
        flightClass,
        nearbyAirPorts,
        nonstopFlight,
        returnDate
      );
      if (textResponse.length === 0)
        textResponse = `Sorry, couldn't find flights from ${cityNamePickup} to ${cityNameDestination} for this parameters, try to change the parameters`;
      break;

    case 'hotels':
      // console.log(`hotels intent`);

      textResponse = await handleHotelsIntent(
        hotelCity,
        checkInDate,
        checkOutDate,
        adults,
        rooms
      );

      // console.log(`textResponse from hotels intent: ${textResponse}`);

      if (textResponse.length === 0)
        textResponse = `Sorry, couldn't find hotels in this city ${hotelCity} in checkin date ${checkInDate} and checkout date ${checkOutDate}`;

      break;

    case 'attractions':
      console.log('attractions intent');
      console.log(`attractions intent location: ${location}`);
      const fulfillmentMessagesList = await handleAttractionsIntent(
        location,
        preference
      );

      if (fulfillmentMessagesList.length === 0) {
        textResponse = `Sorry couldn't find attractions in ${location} matching ${preference}`;
        break;
      }

      console.log(
        `fulfillmentMessagesList: ${JSON.stringify(fulfillmentMessagesList)}`
      );

      res.status(200).json({
        fulfillmentMessages: fulfillmentMessagesList,
      });

      return;

      break;

    case 'timeout':
      console.log('timeout intent');
      function wait(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
      }

      await wait(2000);

      textResponse = await Chatbot.findOne({ sessionId });

      break;

    default:
      console.log(`intent not found`);
      textResponse = "this intent can't be found";
      break;
  }

  // console.log(`textResponse: ${textResponse}`);
  const storedSession = await Chatbot.findOne({ sessionId });
  if (storedSession) {
    storedSession.message = textResponse;
    await storedSession.save({ validateModifiedOnly: true });
  } else {
    await Chatbot.create({
      sessionId: sessionId.toString(),
      message: textResponse,
    });
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

//////////////////////////////////////
function extractDate(datetime) {
  const date = datetime.split('T');
  const dateString = date[0].toString();
  console.log(`dateString: ${dateString}`);
  console.log(`dateString type: ${typeof dateString}`);
  return dateString;
}

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
    const { name, price, description } = tour;
    message += `\u2022 Tour ${index + 1}:\n`;
    message += `   Name: ${name}\n`;
    message += `   Description: ${description}\n`;
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
  // sortingOrder,
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
        sortOrder: 'PRICE',
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

    // console.log(`options: ${options}`);
    const response = await axios.request(options);

    console.log('res.data.data: ', response.data.data);
    console.log('res.data: ', response.data);
    console.log('res', response);
    // console.log('responseOFFlights: ', JSON.stringify(response));
    const flights = response.data.data.flights;
    console.log('flights: ', flights[0]);
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
  // sortingOrder,
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
  if (!isValidDateFormat(departureDate) && new Date(departureDate) < Date.now())
    return (text = `Please provide a valid and correct format of departure date`);

  // validate sortingOrder
  // if (!sortingOrder)
  //   return (text =
  //     'Please provide a sorting order either ML_BEST_VALUE or PRICE');
  // if (sortingOrder !== 'ML_BEST_VALUE' && sortingOrder !== 'PRICE')
  //   return (text = `Please provide correct sorting order either ML_BEST_VALUE or PRICE,  the provided sorting order ${sortingOrder} isn't valid`);

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
    if (!isValidDateFormat(returnDate) && returnDate < departureDate)
      return (text =
        'Please provide a valid and correct format of return date');
  }

  // if everthing is ok retrun 'correct'
  return 'correct';
};

const constructFlightText = (flights) => {
  const flightDetails = flights.map((flight, index) => {
    const { segments } = flight;
    const departureDateTime = segments[0].legs[0].departureDateTime;
    const arrivalDateTime =
      segments[segments.length - 1].legs[0].arrivalDateTime;
    const airline = segments[0].legs[0].operatingCarrier.displayName;

    // Find the corresponding purchase link based on flight details
    const matchingPurchaseLink = flight.purchaseLinks.find(
      (purchaseLink) =>
        purchaseLink.totalPrice && purchaseLink.totalPrice !== ''
    );

    const price = matchingPurchaseLink
      ? matchingPurchaseLink.totalPrice
      : 'N/A';

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

  // Return the text
  return text;
};

const handleFlightsIntent = async (
  cityNamePickup,
  cityNameDestination,
  departureDate,
  flightType,
  // sortingOrder,
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
    // sortingOrder,
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
    // sortingOrder,
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
  5. Number of adults (ages between 18-64 years): [numAdults]
  6. Number of seniors (65 years or above): [numOfSeniors]
  7. Flight class (ECONOMY, PREMIUM_ECONOMY, BUSINESS, or FIRST): [flightClass]
  8. Include nearby airports (yes or no): [nearbyAirPorts]
  9. Nonstop flight only (yes or no): [nonstopFlight]
  10. Return date (in the format year-month-day, required for ROUND_TRIP): [returnDate]
  
  Please provide the requested information with their respective values. Thank you!
  `;
};

////////////////////////////////////////////////////////////////
// Hotels

const getGeoId = async (hotelCity) => {
  console.log(`hotelCity: ${hotelCity}`);
  try {
    const options = {
      method: 'GET',
      url: 'https://tripadvisor16.p.rapidapi.com/api/v1/hotels/searchLocation',
      params: { query: hotelCity },
      headers: {
        'X-RapidAPI-Key': process.env.TRIPADVISOR_API_KEY,
        'X-RapidAPI-Host': 'tripadvisor16.p.rapidapi.com',
      },
    };

    const response = await axios.request(options);
    const geoid = response.data.data[0].geoId;
    console.log(`geoid string: ${geoid}`);
    const numericGeoid = geoid.split(';')[1];
    console.log(`numericGeoID: ${numericGeoid}`);
    return numericGeoid;
  } catch (error) {
    console.error(`error getting the geoid of ${hotelCity}: ${error}`);
  }
};

const getHotelsFromAPI = async (
  geoId,
  checkInDate,
  checkOutDate,
  adults,
  rooms
) => {
  try {
    // console.log(`GEOID inside getHotels ${geoId}`);
    // console.log(`GEOID inside getHotels type ${typeof Number(geoId)}`);
    const options = {
      method: 'GET',
      url: 'https://tripadvisor16.p.rapidapi.com/api/v1/hotels/searchHotels',
      params: {
        geoId: `${geoId}`,
        checkIn: checkInDate,
        checkOut: checkOutDate,
        pageNumber: '1',
        // adults: adults || '1',
        // rooms: rooms || '1',
        // currencyCode: 'USD',
      },
      headers: {
        'X-RapidAPI-Key': process.env.TRIPADVISOR_API_KEY,
        'X-RapidAPI-Host': 'tripadvisor16.p.rapidapi.com',
      },
    };

    const response = await axios.request(options);
    // console.log(`response: ${response}`);
    // console.log(`response data: ${response.data}`);
    // console.log(`response status: ${response.status}`);
    // console.log(`response data JSON: ${JSON.stringify(response.data)}`);
    return response.data;
  } catch (error) {
    console.error(error);
    // throw new Error('Failed to fetch hotel data');
  }
};

const constructHotelsText = (hotelData) => {
  let result = '';
  // console.log(`hotels length: ${hotelData.data.data.length}`);
  const data = hotelData.data.data.slice(0, 5);
  // console.log(`data: ${data}`);

  // Add hotel data
  data.forEach((hotel) => {
    result += `• ${hotel.title}\n`;
    result += `  Rating: ${hotel.bubbleRating.rating}/5 (based on ${hotel.bubbleRating.count} reviews)\n`;
    result += `  Provider: ${hotel.provider}\n`;
    result += `  Price: ${hotel.priceForDisplay}\n`;
    if (hotel.primaryInfo) {
      result += `  ${hotel.primaryInfo}\n`;
    }
    if (hotel.secondaryInfo) {
      result += `  ${hotel.secondaryInfo}\n`;
    }
    if (hotel.badge && hotel.badge.type === 'TRAVELLER_CHOICE') {
      result += `  TRAVELLER'S CHOICE\n`;
    }
  });

  return result;
};

const validateHotelParams = (checkInDate, checkOutDate) => {
  let text = '';

  if (!checkInDate)
    return (text = 'Please provide checkin date in year-month-day format.');
  if (!isValidDateFormat(checkInDate || new Date(checkInDate) < Date.now()))
    return (text = `Please provide checkin date in year-month-day format, you should provide also the checkout date`);

  if (!checkOutDate)
    return (text = 'Please provide checkout date in year-month-day format ');
  if (!isValidDateFormat(checkOutDate || checkOutDate > checkInDate))
    return (text = `Please provide checkout date in year-month-day format`);

  // if everything is ok return correct
  return 'correct';
};

const handleHotelsIntent = async (
  hotelCity,
  checkInDate,
  checkOutDate,
  adults,
  rooms
) => {
  let text = '';

  if (!hotelCity) return (text = 'Please provide the city');

  const geoId = await getGeoId(hotelCity);
  if (!geoId) return (text = `can't find this city: ${hotelCity}`);

  text = validateHotelParams(checkInDate, checkOutDate);
  if (text !== 'correct') return text;

  const hotelsData = await getHotelsFromAPI(
    geoId,
    checkInDate,
    checkOutDate,
    adults,
    rooms
  );

  text = constructHotelsText(hotelsData);

  return text;
};

// const handleHotelsIntent = async (
//   hotelCity,
//   checkInDate,
//   checkOutDate,
//   adults,
//   rooms
// ) => {
//   if (!hotelCity) return 'Please provide the city.';

//   try {
//     const [geoId, validationMessage] = await Promise.all([
//       getGeoId(hotelCity),
//       validateHotelParams(checkInDate, checkOutDate),
//     ]);

//     if (!geoId) return `Can't find hotels for this city: ${hotelCity}`;
//     if (validationMessage !== 'correct') return validationMessage;

//     const hotelsData = await getHotelsFromAPI(
//       geoId,
//       checkInDate,
//       checkOutDate,
//       adults,
//       rooms
//     );

//     const hotelsText = constructHotelsText(hotelsData);

//     return hotelsText;
//   } catch (error) {
//     console.error(`Error handling hotels intent: ${error}`);
//     throw new Error('Failed to handle hotels intent');
//   }
// };

const getAttractions = async (location, prefrence) => {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY; // Replace with your Google Places API key

  const baseUrl = 'https://maps.googleapis.com/maps/api/place/textsearch/json';

  console.log(`location: ${location}`);
  const query = `${prefrence}%20in%20${location}`;

  const url = `${baseUrl}?key=${apiKey}&query=${query}`;

  console.log(`url: ${url}`);

  let places = [];

  const response = await axios.get(url);
  const results = response.data.results;

  // Extract only the required fields from the results
  const filteredResults = results.map((result) => {
    const { name, rating, geometry, formatted_address, photos, place_id } =
      result;
    return {
      name,
      rating,
      placeId: place_id,
      link: `https://maps.google.com/?q=${name.replace(/ /g, '-')}`,
      coordinates: [geometry.location.lng, geometry.location.lat],
      address: formatted_address,
      photo: photos && photos.length > 0 ? photos[0].photo_reference : null,
    };
  });

  console.log(`filteredResults: ${JSON.stringify(filteredResults)}`);

  // Get the top 5 attractions
  const top5Attractions = filteredResults.slice(0, 5);

  console.log(`attractions: ${JSON.stringify(top5Attractions)}`);

  return top5Attractions;
};

const constructAttractionText = (attractions) => {
  const fulfillmentMessagesList = [];

  attractions.forEach((attraction) => {
    let cardText = '';

    cardText += `• ${attraction.name}\n`;
    cardText += `  Rating: ${attraction.rating}\n`;
    cardText += `  Address: ${attraction.address}\n`;

    const cardObj = {
      card: {
        title: attraction.name,
        subtitle: cardText,
        imageUri: attraction.photo,
        buttons: [
          {
            text: `${attraction.name} Link`,
            postback: attraction.link,
          },
        ],
      },
    };

    fulfillmentMessagesList.push(cardObj);
  });

  return fulfillmentMessagesList;
};

const handleAttractionsIntent = async (location, prefrence) => {
  // get the attractions list
  const attractions = await getAttractions(location, prefrence);

  // construct the card list
  const fulfillmentMessagesList = constructAttractionText(attractions);

  // return the card list
  return fulfillmentMessagesList;
};
