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
const faker = require('faker');

const createUser = async () => {
  for (let i = 0; i < 6000; i++) {
    console.log(`i: ${i + 1}`);

    const newUser = new User({
      name: faker.name.findName(),
      image: `https://source.unsplash.com/200x200/?person&${faker.datatype.uuid()}`,
      email: faker.internet.email(),
      password: 'Password123@',
      passwordConfirm: 'Password123@',
      role: 'user',
      gender: faker.random.arrayElement(['male', 'female']),
      contact: faker.datatype.number({ min: 1111111111, max: 9999999999 }),
    });

    try {
      await newUser.save();
      console.log(`User ${i + 1} created successfully`);
    } catch (error) {
      console.error(`Error creating User ${i + 1}:`, error);
    }
  }
  console.log('done...');
};

createUser();
