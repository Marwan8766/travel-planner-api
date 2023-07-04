const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const Tour = require('../models/tourModel');
const plannedTripController = require('./plannedTripsController');
const sendMail = require('../utils/email');
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
    // customized trip
    likes_beaches,
    likes_museums,
    likes_nightlife,
    likes_outdoorActivities,
    likes_shopping,
    likes_food,
    likes_sports,
    likes_relaxation,
    likes_familyFriendlyActivities,
    crowdLevel,
    startDate,
    endDate,
    destination,
    email,
  } = req.body.queryResult.parameters;

  console.log(`req.body: ${JSON.stringify(req.body)}`);

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
  if (Location && !location) location = Location;

  console.log(`locationFirstParameter: ${location}`);

  // console.log(`location: ${location}`);
  // console.log(`budget: ${budget}`);
  // console.log(`Date_period: ${Date_period}`);

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

      // const payload = { richContent: [[...fulfillmentMessagesList]] };

      // res.status(200).json({
      //   fulfillmentMessages: payload,
      // });

      const payload = { richContent: [[...fulfillmentMessagesList]] };

      console.log(`payload: ${JSON.stringify([payload])}`);

      res.status(200).json({
        fulfillmentMessages: [{ payload }],
      });

      return;

      break;

    case 'customizedTrip':
      textResponse = await handleCustomizedTripIntent(
        likes_beaches,
        likes_museums,
        likes_nightlife,
        likes_outdoorActivities,
        likes_shopping,
        likes_food,
        likes_sports,
        likes_relaxation,
        likes_familyFriendlyActivities,
        crowdLevel,
        startDate,
        endDate,
        destination,
        budget,
        email
      );

      if (textResponse.length === 0)
        textResponse = 'Sorry something went wrong, please try again';

      break;

    case 'timeout':
      console.log('timeout intent');
      function wait(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
      }

      await wait(2000);

      const storedSessionDoc = await Chatbot.findOne({ sessionId });
      textResponse = storedSessionDoc.message;

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

//////////////////////////////////////
function extractDate(datetime) {
  if (!datetime || datetime.length === 0) return ''; // added this line
  const date = datetime.toString().split('T');
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
  if (!cityNamePickup) return (text = 'Please provide the pickup city name');
  const pickupAirportCode = await getAirportCode(cityNamePickup);
  if (!pickupAirportCode)
    return (text = `Please provide the pickup city name correctly this pickup city name ${cityNamePickup} isnot correct`);

  // find the destination airport code
  if (!cityNameDestination)
    return (text = 'Please provide the destination city name');
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
      link: `https://www.google.com/maps/place/?q=place_id:${place_id}`,
      coordinates: [geometry.location.lng, geometry.location.lat],
      address: formatted_address,
      photo: photos && photos.length > 0 ? photos[0].photo_reference : null,
    };
  });

  console.log(`filteredResults: ${JSON.stringify(filteredResults)}`);

  // Sort the filtered results by rating in descending order
  filteredResults.sort((a, b) => b.rating - a.rating);

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
      type: 'info',
      title: attraction.name,
      subtitle: cardText,
      image: {
        src: {
          rawUrl:
            'https://lh5.googleusercontent.com/p/AF1QipMhqZBmtN50qAShPpwCoTTW64ONqr107pbIUlIH=w533-h240-k-no',
        },
      },
      actionLink: attraction.link,
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

////////////////////////////////////////////////
////////////////////////////////////////////////
////////////////////////////////////////////////

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

    const query = `${types.join('|')} ${location}`;

    let url = `${baseUrl}?key=${apiKey}&query=${query}`;

    let numberOfDays = 5;

    if (startDate && endDate)
      numberOfDays = getNumberOfDays(startDate, endDate);
    const desiredNumberOfPlaces = Math.min(5 * numberOfDays, 70); // Maximum 5 places per day for a maximum of 14 days

    let places = [];
    let nextPageToken = null;

    while (places.length < desiredNumberOfPlaces) {
      if (nextPageToken) {
        url += `&pagetoken=${nextPageToken}`;
        console.log(`pagetoken: ${nextPageToken}`);
      }

      const response = await axios.get(url);
      const results = response.data.results;
      console.log(`response.nextPage: ${response.data.next_page_token}`);

      // Extract only the required fields from the results
      const filteredResults = results.map((result) => {
        const { name, rating, geometry, formatted_address, photos, place_id } =
          result;
        return {
          name,
          rating,
          placeId: place_id,
          link: `https://www.google.com/maps/place/?q=place_id:${place_id}`,
          coordinates: [geometry.location.lng, geometry.location.lat],
          address: formatted_address,
          photo: photos && photos.length > 0 ? photos[0].photo_reference : null,
        };
      });

      places = places.concat(filteredResults);

      if (response.data.next_page_token) {
        nextPageToken = response.data.next_page_token;

        console.log(`nextpagetoken: ${nextPageToken}`);

        // Introduce a delay before fetching the next page of results
        await new Promise((resolve) => setTimeout(resolve, 2000));
      } else {
        break;
      }
    }

    return places;
  } catch (error) {
    console.error('Error retrieving places from Google Maps:', error);
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
  const locationCoordinates = await plannedTripController.getCityRadius(
    location
  );
  if (!locationCoordinates) return [];
  const numberOfDays = getNumberOfDays(startDate, endDate);
  const desiredNumberOfTours = 3 * numberOfDays;

  const tours = await Tour.find({
    'startLocations.coordinates': {
      $geoWithin: {
        $centerSphere: [
          [locationCoordinates.lng, locationCoordinates.lat],
          locationCoordinates.radius,
        ],
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
          date: date,
          availableSeats: { $gte: 1 },
        });
        return availability && availability.availableSeats >= 1 ? tour : null;
      })
    );

    const dayTours = filteredTours.filter((tour) => tour !== null);
    const timeline = [];

    let maxAttractions;
    let maxTours;

    if (crowdLevel === 'busy') {
      maxAttractions = 5;
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
        date: date,
        availableSeats: { $gte: 1 },
      });

      if (tourAvailability) {
        const startTime = getRandomTime(date);
        const endTime = getRandomTime(date);
        const tourTimeRange = { startTime, endTime };

        timeline.push({
          tour: tour._id,
          startTime,
          endTime,
        });

        if (timeline.length >= maxTours) {
          break;
        }
      }
    }

    // Allocate attractions to the timeline
    while (
      attractions.length > 0 &&
      (timeline.length < maxAttractions ||
        timeline.length < maxTours + maxAttractions)
    ) {
      const startTime = getRandomTime(date);
      const endTime = getRandomTime(date);
      const attractionTimeRange = { startTime, endTime };

      timeline.push({
        attraction: {
          coordinates: attractions[0].coordinates,
          name: attractions[0].name,
          link: attractions[0].link,
          rating: attractions[0].rating,
          description: attractions[0].description,
          image: attractions[0].photo,
          address: attractions[0].address,
          placeId: attractions[0].placeId,
        },
        startTime,
        endTime,
      });
      attractions.shift();
    }

    // Sort the timeline entries by start time
    timeline.sort((a, b) => a.startTime - b.startTime);

    // Repair overlapping times
    for (let j = 1; j < timeline.length; j++) {
      const previousEndTime = timeline[j - 1].endTime;
      const currentStartTime = timeline[j].startTime;

      if (previousEndTime > currentStartTime) {
        timeline[j].startTime = previousEndTime;
        timeline[j].endTime = getRandomTime(date);
      }
    }

    days.push({ date, timeline });
  }

  console.log(`days: ${JSON.stringify(days)}`);
  return days;
};

const createCustomizedTripMessage = (days) => {
  let message = '';

  days.forEach((day, index) => {
    const { date, timeline } = day;
    const formattedDate = date.toDateString();

    message += `Day ${index + 1} - ${formattedDate}\n`;

    timeline.forEach((entry) => {
      if (entry.tour) {
        const { startTime, endTime } = entry;
        const formattedStartTime = startTime.toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        });
        const formattedEndTime = endTime.toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        });
        const { name, link } = entry.tour;

        message += `• Tour: ${name}\n`;
        message += `  Time: ${formattedStartTime} - ${formattedEndTime}\n`;
        message += `  More Info: ${link}\n`;
      } else if (entry.attraction) {
        const { startTime, endTime } = entry;
        const formattedStartTime = startTime.toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        });
        const formattedEndTime = endTime.toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        });
        const { name, link, address } = entry.attraction;

        message += `• Attraction: ${name}\n`;
        message += `  Time: ${formattedStartTime} - ${formattedEndTime}\n`;
        message += `  Address: ${address}\n`;
        message += `  More Info: ${link}\n`;
      }
    });

    message += '\n'; // Add a line break after each day's information
  });

  return message;
};

const sendCustomizedTripMail = async (email, message) => {
  const html = `
    <h1>Your Customized Planned Trip</h1>
    <p>${message}</p>
    <h2>Thanks for using our auto trip planner, TRAVEL GATE</h2>
  `;

  const optionsObj = {
    email,
    subject: 'Your Customized Planned Trip',
    html,
  };

  await sendMail(optionsObj);
};

const handleCustomizedTripIntent = async (
  likes_beaches,
  likes_museums,
  likes_nightlife,
  likes_outdoorActivities,
  likes_shopping,
  likes_food,
  likes_sports,
  likes_relaxation,
  likes_familyFriendlyActivities,
  crowdLevel,
  startDate,
  endDate,
  destination,
  budget,
  email
) => {
  const preferences = {};
  let message = '';

  if (likes_beaches && likes_beaches.length > 0)
    preferences['likes_beaches'] = true;
  if (likes_museums && likes_museums.length > 0)
    preferences['likes_museums'] = true;
  if (likes_nightlife && likes_nightlife.length > 0)
    preferences['likes_nightlife'] = true;
  if (likes_outdoorActivities && likes_outdoorActivities.length > 0)
    preferences['likes_outdoorActivities'] = true;
  if (likes_shopping && likes_shopping.length > 0)
    preferences['likes_shopping'] = true;
  if (likes_food && likes_food.length > 0) preferences['likes_food'] = true;
  if (likes_sports && likes_sports.length > 0)
    preferences['likes_sports'] = true;
  if (likes_relaxation && likes_relaxation.length > 0)
    preferences['likes_relaxation'] = true;
  if (
    likes_familyFriendlyActivities &&
    likes_familyFriendlyActivities.length > 0
  )
    preferences['likes_familyFriendlyActivities'] = true;

  // get attractions from google maps
  const attractions = await searchPlacesByPreferences(
    preferences,
    startDate,
    endDate,
    destination
  );

  const matchedTours = await findMatchingTours(destination, startDate, endDate);

  const days = await createTripDays(
    attractions,
    matchedTours,
    new Date(startDate),
    new Date(endDate),
    crowdLevel
  );

  message = createCustomizedTripMessage(days);

  if (email && email.length > 0) await sendCustomizedTripMail(email, message);

  return message;
};
