const Tour = require('../../models/tourModel');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const axios = require('axios');

const plannedTripController = require('../../controllers/plannedTripsController');

process.on('uncaughtException', (err) => {
  console.log('UNCAUGHT EXCEPTION, server is shutting down...');
  console.log(err.name, err.message);
  process.exit(1);
});

dotenv.config({ path: './config.env' });

const DB = process.env.DATABASE.replace(
  '<PASSWORD>',
  process.env.DATABASE_PASSWORD
);
mongoose.connect(DB, {
  useNewUrlParser: true,
  useCreateIndex: true,
  useFindAndModify: false,
  useUnifiedTopology: true,
});

// Function to find a random address within a city
function generateRandomCoordinatesWithinRadius(
  longitude,
  latitude,
  radiusInRadians
) {
  // Random angle in radians
  const randomAngle = Math.random() * 2 * Math.PI;

  // Calculate random distance within the radius
  const randomDistance = Math.random() * radiusInRadians;

  // Convert latitude and longitude to radians
  const latitudeInRadians = (latitude * Math.PI) / 180;
  const longitudeInRadians = (longitude * Math.PI) / 180;

  // Calculate new latitude and longitude coordinates
  const newLatitude = Math.asin(
    Math.sin(latitudeInRadians) * Math.cos(randomDistance) +
      Math.cos(latitudeInRadians) *
        Math.sin(randomDistance) *
        Math.cos(randomAngle)
  );
  const newLongitude =
    longitudeInRadians +
    Math.atan2(
      Math.sin(randomAngle) *
        Math.sin(randomDistance) *
        Math.cos(latitudeInRadians),
      Math.cos(randomDistance) -
        Math.sin(latitudeInRadians) * Math.sin(newLatitude)
    );

  // Convert latitude and longitude back to degrees
  const newLatitudeInDegrees = (newLatitude * 180) / Math.PI;
  const newLongitudeInDegrees = (newLongitude * 180) / Math.PI;

  return [newLongitudeInDegrees, newLatitudeInDegrees];
}

// Function to get random cities from API
async function getRandomCities(page) {
  try {
    const options = {
      method: 'GET',
      url: 'https://city-and-state-search-api.p.rapidapi.com/cities/search',
      params: {
        q: ' ',
        page: page.toString(),
      },
      headers: {
        'X-RapidAPI-Key': process.env.CITY_SEARCH_API_KEY,
        'X-RapidAPI-Host': 'city-and-state-search-api.p.rapidapi.com',
      },
    };

    const response = await axios.request(options);
    console.log(`response.data: ${response.data.toString()}`);
    const cities = response.data;
    return cities;
  } catch (error) {
    console.log('Error fetching random cities:', error.message);
    return [];
  }
}

// Function to select a random city from the array
function selectRandomCity(cities) {
  const randomIndex = Math.floor(Math.random() * cities.length);
  return cities[randomIndex];
}

// Function to update tour start location
async function updateStartLocation(tour, coordinates) {
  tour.startLocations.coordinates = coordinates;
}

// Function to update tour locations
async function updateTourLocations(tour, lon, lat, radius) {
  tour.locations.forEach((location) => {
    // get random coordinates
    const coordinates = generateRandomCoordinatesWithinRadius(lon, lat, radius);
    location.coordinates = coordinates;
  });
}

async function updateAllTours() {
  try {
    const tours = await Tour.find();
    console.log(`number of tours ${tours.length}`);
    let toursCount = 0;
    let page = 117;
    let pageChange = false;
    let cities = await getRandomCities(page);
    let notFoundRad = false;

    for (let i = 3484; i < tours.length; i++) {
      console.log(`Tour: ${i + 1}`);
      const tour = tours[i];
      // console.log(`tour ${i + 1}: ${tour}`);

      pageChange = false;
      notFoundRad = false;

      toursCount++;
      if (toursCount === 30) {
        toursCount = 0;
        page++;
        pageChange = true;
      }

      if (pageChange) {
        // get random cities
        cities = await getRandomCities(page);
      }

      // select random city from cities
      const cityObj = selectRandomCity(cities);

      console.log(`cityObj: ${cityObj} `);

      tour.startLocations.city = cityObj.name;
      tour.startLocations.country = cityObj.country_name;

      console.log(`city name: ${cityObj.name}`);
      // get the city coordinates
      let lat;
      let lng;
      let radius;
      try {
        coordRes = await plannedTripController.getCityRadius(cityObj.name);
        lat = coordRes.lat;
        lng = coordRes.lng;
        radius = coordRes.radius;

        if (!lat || !lng || !radius) notFoundRad = true;
      } catch {
        console.log('cannot find the radius');
        notFoundRad = true;
        // continue;
      }

      if (notFoundRad) {
        i--;
        continue;
      }

      console.log(`lat: ${lat}   lng: ${lng}  radius: ${radius}`);
      if (!lng || !lat || !radius) {
        console.log(`cannot find coordinates of city...`);
        continue;
      }

      const coordinates = [lng, lat];

      // update startLocation
      await updateStartLocation(tour, coordinates);

      await updateTourLocations(tour, lng, lat, radius);

      console.log('Tour updated successfully:', tour.name);
      await tour.save({ validateModifiedOnly: true });
    }

    console.log('All tours updated successfully');
    process.exit();
  } catch (error) {
    console.log('Error:', error.message);
    process.exit(1);
  }
}

updateAllTours();
