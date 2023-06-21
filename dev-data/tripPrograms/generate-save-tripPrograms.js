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
const faker = require('faker');

// loop over all users and add their ids to user array
const getCompanyIds = async () => {
  let users = await User.find();
  return users
    .filter((user) => user.role === 'company')
    .map((user) => user._id);
};

// loop over all tours and add their ids to tours array
const getTours = async () => {
  return await Tour.find();
};

const filterToursByCompany = (companyId, tours) => {
  return tours.filter(
    (tour) => tour.company.toString() === companyId.toString()
  );
};

const createRandomTripPrograms = async () => {
  const companies = await getCompanyIds();
  const tours = await getTours();

  for (let i = 0; i < 1000; i++) {
    console.log(`i: ${i + 1}`);
    const randomCompany = faker.random.arrayElement(companies);

    const filteredTours = filterToursByCompany(randomCompany, tours);

    const randomNumberOfTours = faker.datatype.number({
      min: 1,
      max: filteredTours.length,
    });

    if (filteredTours.length === 0) continue;

    const randomTours = [];
    for (let i = 0; i < randomNumberOfTours; i++) {
      const randomTour = faker.random.arrayElement(filteredTours);
      randomTours.push(randomTour);
    }

    const numberOfLocations = faker.datatype.number({ min: 1, max: 5 });
    const locations = [];

    for (let j = 1; j <= numberOfLocations; j++) {
      const location = {
        coordinates: [faker.address.longitude(), faker.address.latitude()],
        address: faker.address.streetAddress(),
        description: faker.lorem.sentence(),
        day: j,
      };

      locations.push(location);
    }

    const tripProgramData = {
      name:
        faker.address.cityPrefix() + ' ' + faker.address.citySuffix() + ' Trip',
      price: faker.datatype.number({ min: 100, max: 10000 }),
      summary: faker.lorem.sentence(),
      description: faker.lorem.paragraph(),
      image: faker.image.imageUrl(),
      startLocations: {
        coordinates: [faker.address.longitude(), faker.address.latitude()],
        address: faker.address.streetAddress(),
        description: faker.lorem.sentence(),
      },
      locations,
      tour: randomTours,
      company: randomCompany,
    };

    await TripProgram.create(tripProgramData);
  }

  console.log('Done...');
};

createRandomTripPrograms();
