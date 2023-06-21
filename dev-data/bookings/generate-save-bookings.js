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
  useUnifiedTopology: true, // that is what i added due to terminal error
});

const User = require('../../models/userModel');
const Tour = require('../../models/tourModel');
const TripProgram = require('../../models/tripProgramsmodel');
const Booking = require('../../models/booking.model');
const faker = require('faker');

// loop over all users and add their ids to user array
const getUsersIds = async () => {
  let users = await User.find();
  return users.filter((user) => user.role === 'user').map((user) => user._id);
};

// loop over all tours and add their ids to tours array
const getToursIds = async () => {
  let tours = await Tour.find();
  return tours.map((tour) => tour._id);
};

const getTripProgramsIds = async () => {
  let tripPrograms = await TripProgram.find();
  return tripPrograms.map((tripProgram) => tripProgram._id);
};

const createRandomBookingsTour = async () => {
  const users = await getUsersIds();
  const tours = await getToursIds();

  // select random user and tour and create booking
  for (let i = 0; i < 1000; i++) {
    console.log(`i: ${i + 1}`);
    // Change the loop limit as desired
    const randomUser = faker.random.arrayElement(users);
    const randomTour = faker.random.arrayElement(tours);
    const randomQuantity =
      Math.random() < 0.6 ? 1 : faker.datatype.number({ min: 2, max: 5 });

    // Generate random date between 1 year ago and today
    const startDate = faker.date.between(
      new Date(new Date().setFullYear(new Date().getFullYear() - 1)),
      new Date()
    );

    const tour = await Tour.findById(randomTour);
    const price = tour.price * randomQuantity;
    const company = tour.company;

    const booking = await Booking.create({
      status: 'reserved',
      paid: true,
      price,
      quantity: randomQuantity,
      CreatedAt: startDate,
      updatedAt: startDate,
      tour: randomTour,
      user: randomUser,
      company,
    });
  }
  console.log('Done...');
};

const createRandomBookingsTripPrograms = async () => {
  const users = await getUsersIds();
  const tripPrograms = await getTripProgramsIds();

  // select random user and tour and create booking
  for (let i = 0; i < 1000; i++) {
    console.log(`i: ${i + 1}`);
    // Change the loop limit as desired
    const randomUser = faker.random.arrayElement(users);
    const randomTripProgram = faker.random.arrayElement(tripPrograms);
    const randomQuantity =
      Math.random() < 0.6 ? 1 : faker.datatype.number({ min: 2, max: 5 });

    // Generate random date between 1 year ago and today
    const startDate = faker.date.between(
      new Date(new Date().setFullYear(new Date().getFullYear() - 1)),
      new Date()
    );

    const tripProgram = await TripProgram.findById(randomTripProgram);
    const price = tripProgram.price * randomQuantity;
    const company = tripProgram.company;

    const booking = await Booking.create({
      status: 'reserved',
      paid: true,
      price,
      quantity: randomQuantity,
      CreatedAt: startDate,
      updatedAt: startDate,
      tripProgram: randomTripProgram,
      user: randomUser,
      company,
    });
  }
  console.log('Done...');
};
createRandomBookingsTour();
// createRandomBookingsTripPrograms();
