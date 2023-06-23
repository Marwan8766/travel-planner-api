const Tour = require('../../models/tourModel');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const axios = require('axios');

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

// Function to get coordinates for a given address using OpenStreetMap Nominatim API
const getCoordinates = async (address) => {
  try {
    const response = await axios.get(
      'https://nominatim.openstreetmap.org/search',
      {
        params: {
          q: address,
          format: 'json',
        },
      }
    );
    if (response.data && response.data.length > 0) {
      const { lat, lon } = response.data[0];
      return [parseFloat(lon), parseFloat(lat)]; // Return coordinates as [longitude, latitude]
    } else {
      console.error('No coordinates found for the address:', address);
      return null;
    }
  } catch (error) {
    console.error('Error getting coordinates:', error);
    return null;
  }
};

// Function to get coordinates for a random city using OpenStreetMap Nominatim API
const getRandomCityCoordinates = async () => {
  try {
    const response = await axios.get(
      'https://nominatim.openstreetmap.org/search',
      {
        params: {
          q: 'city',
          format: 'json',
          limit: 1,
        },
      }
    );
    if (response.data && response.data.length > 0) {
      const { lat, lon } = response.data[0];
      return [parseFloat(lon), parseFloat(lat)]; // Return coordinates as [longitude, latitude]
    } else {
      console.error('No coordinates found for a random city');
      return null;
    }
  } catch (error) {
    console.error('Error getting coordinates for a random city:', error);
    return null;
  }
};

// Function to update the startLocation and locations coordinates in each tour
const updateTourCoordinates = async () => {
  try {
    const tours = await Tour.find();

    let i = 1;
    for (const tour of tours) {
      console.log(`Tour number ${i}`);
      i++;

      let startLocationCoordinates = null;
      if (tour.startLocations.address) {
        startLocationCoordinates = await getCoordinates(
          tour.startLocations.address
        );

        if (!startLocationCoordinates) {
          startLocationCoordinates = await getRandomCityCoordinates();
          if (!startLocationCoordinates) {
            console.error('No coordinates found for the start location');
            continue; // Skip this tour and move to the next one
          }
          tour.startLocations.coordinates = startLocationCoordinates;
        } else {
          tour.startLocations.coordinates = startLocationCoordinates;
        }
      } else {
        startLocationCoordinates = await getRandomCityCoordinates();
        if (!startLocationCoordinates) {
          console.error('No coordinates found for the start location');
          continue; // Skip this tour and move to the next one
        }
        tour.startLocations.coordinates = startLocationCoordinates;
      }

      for (const location of tour.locations) {
        let locationCoordinates = null;

        if (location.address) {
          locationCoordinates = await getCoordinates(location.address);

          if (!locationCoordinates) {
            locationCoordinates = await getRandomCityCoordinates();
            if (!locationCoordinates) {
              console.error('No coordinates found for a location');
              continue; // Skip this location and move to the next one
            }
            location.coordinates = locationCoordinates;
          } else {
            location.coordinates = locationCoordinates;
          }
        } else {
          locationCoordinates = await getRandomCityCoordinates();
          if (!locationCoordinates) {
            console.error('No coordinates found for a location');
            continue; // Skip this location and move to the next one
          }
          location.coordinates = locationCoordinates;
        }
      }

      await tour.save();
    }

    console.log('Tour coordinates updated successfully.');
    process.exit();
  } catch (error) {
    console.error('Error updating tour coordinates:', error);
    process.exit(1);
  }
};

const runUpdateOnce = async () => {
  try {
    await updateTourCoordinates();
    console.log('Update function executed successfully.');
  } catch (error) {
    console.error('Error executing update function:', error);
  }
};

// Call the function to run the update once
runUpdateOnce();
