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

const Review = require('../../models/review.model');
const User = require('../../models/userModel');
const Tour = require('../../models/tourModel');
const TripProgram = require('../../models/tripProgramsmodel');
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

const createRandomReviewsTour = async () => {
  const users = await getUsersIds();
  const tours = await getToursIds();

  // select random user and tour and create review
  for (let i = 0; i < 4000; i++) {
    console.log(`i: ${i + 1}`);
    // Change the loop limit as desired
    const randomUser = faker.random.arrayElement(users);
    const randomTour = faker.random.arrayElement(tours);
    const randomDescription = faker.lorem.paragraphs(2);
    const randomRating = faker.datatype.number({ min: 1, max: 5 });

    const review = await Review.create({
      description: randomDescription,
      rating: randomRating,
      tour: randomTour,
      user: randomUser,
    });
  }
  console.log('Done...');
};

createRandomReviewsTour();
