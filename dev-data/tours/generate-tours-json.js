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

const Tour = require('../../models/tourModel');
const faker = require('faker');

const tours = [];

// 300 newly created companies
const companyIds = [
  '645debc877c7d936fc7d4610',
  '645debcb77c7d936fc7d4614, ',
  '645debcc77c7d936fc7d4618',
  '645debcd77c7d936fc7d461a',
  '645debce77c7d936fc7d461c',
  '645debcf77c7d936fc7d461e',
  '645debd077c7d936fc7d4620',
  '645debd077c7d936fc7d4622',
  '645debd177c7d936fc7d4624',
  '645debd277c7d936fc7d4626',
  '645debd377c7d936fc7d4628',
  '645debd477c7d936fc7d462a',
  '645debd577c7d936fc7d462c',
  '645debd677c7d936fc7d462e',
  '645debd777c7d936fc7d4630',
  '645debd877c7d936fc7d4632',
  '645debd877c7d936fc7d4634',
  '645debd977c7d936fc7d4636',
  '645debda77c7d936fc7d4638',
  '645debdb77c7d936fc7d463a',
  '645debdc77c7d936fc7d463c',
  '645debdd77c7d936fc7d463e',
  '645debde77c7d936fc7d4640',
  '645debdf77c7d936fc7d4642',
  '645debe077c7d936fc7d4644',
  '645debe077c7d936fc7d4646',
  '645debe177c7d936fc7d4648',
  '645debe277c7d936fc7d464a',
  '645debe377c7d936fc7d464c',
  '645debe477c7d936fc7d464e',
  '645debe477c7d936fc7d4650',
  '645debe577c7d936fc7d4652',
  '645debe777c7d936fc7d4654',
  '645debe777c7d936fc7d4656',
  '645debe877c7d936fc7d4658',
  '645debe977c7d936fc7d465a',
  '645debea77c7d936fc7d465c',
  '645debea77c7d936fc7d465e',
  '645debeb77c7d936fc7d4660',
  '645debec77c7d936fc7d4662',
  '645debed77c7d936fc7d4664',
  '645debed77c7d936fc7d4666',
  '645debee77c7d936fc7d4668',
  '645debef77c7d936fc7d466a',
  '645debf077c7d936fc7d466c',
  '645debf077c7d936fc7d466e',
  '645debf177c7d936fc7d4670',
  '645debf277c7d936fc7d4672',
  '645debf377c7d936fc7d4674',
  '645debf477c7d936fc7d4676',
  '645debf477c7d936fc7d4678',
  '645debf577c7d936fc7d467a',
  '645debf677c7d936fc7d467c',
  '645debf777c7d936fc7d467e',
  '645debf877c7d936fc7d4680',
  '645debf977c7d936fc7d4682',
  '645debf977c7d936fc7d4684',
  '645debfa77c7d936fc7d4686',
  '645debfb77c7d936fc7d4688',
  '645debfc77c7d936fc7d468a',
  '645debfd77c7d936fc7d468c',
  '645debfd77c7d936fc7d468e',
  '645debfe77c7d936fc7d4690',
  '645debff77c7d936fc7d4692',
  '645debff77c7d936fc7d4694',
  '645dec0077c7d936fc7d4696',
  '645dec0177c7d936fc7d4698',
  '645dec0277c7d936fc7d469a',
  '645dec0277c7d936fc7d469c',
  '645dec0377c7d936fc7d469e',
  '645dec0477c7d936fc7d46a0',
  '645dec0577c7d936fc7d46a2',
  '645dec0577c7d936fc7d46a4',
  '645dec0677c7d936fc7d46a6',
  '645dec0777c7d936fc7d46a8',
  '645dec0777c7d936fc7d46aa',
  '645dec0877c7d936fc7d46ac',
  '645dec0977c7d936fc7d46ae',
  '645dec0a77c7d936fc7d46b0',
  '645dec0a77c7d936fc7d46b2',
  '645dec0b77c7d936fc7d46b4',
  '645dec0c77c7d936fc7d46b6',
  '645dec0d77c7d936fc7d46b8',
  '645dec0d77c7d936fc7d46ba',
  '645dec0e77c7d936fc7d46bc',
  '645dec0f77c7d936fc7d46be',
  '645dec0f77c7d936fc7d46c0',
  '645dec1077c7d936fc7d46c2',
  '645dec1177c7d936fc7d46c4',
  '645dec1277c7d936fc7d46c6',
  '645dec1277c7d936fc7d46c8',
  '645dec1377c7d936fc7d46ca',
  '645dec1477c7d936fc7d46cc',
  '645dec1477c7d936fc7d46ce',
  '645dec1577c7d936fc7d46d0',
  '645dec1677c7d936fc7d46d2',
  '645dec1777c7d936fc7d46d4',
  '645dec1777c7d936fc7d46d6',
  '645dec1877c7d936fc7d46d8',
  '645dec6f13806f2f54f3cdcf',
  '645dec7213806f2f54f3cdd3',
  '645dec7313806f2f54f3cdd5',
  '645dec7313806f2f54f3cdd7',
  '645dec7413806f2f54f3cdd9',
  '645dec7513806f2f54f3cddb',
  '645dec7613806f2f54f3cddd',
  '645dec7713806f2f54f3cddf',
  '645dec7813806f2f54f3cde1',
  '645dec7913806f2f54f3cde3',
  '645dec7913806f2f54f3cde5',
  '645dec7a13806f2f54f3cde7',
  '645dec7b13806f2f54f3cde9',
  '645dec7c13806f2f54f3cdeb',
  '645dec7c13806f2f54f3cded',
  '645dec7d13806f2f54f3cdef',
  '645dec7e13806f2f54f3cdf1',
  '645dec7f13806f2f54f3cdf3',
  '645dec7f13806f2f54f3cdf5',
  '645dec8013806f2f54f3cdf7',
  '645dec8113806f2f54f3cdf9',
  '645dec8213806f2f54f3cdfb',
  '645dec8213806f2f54f3cdfd',
  '645dec8313806f2f54f3cdff',
  '645dec8413806f2f54f3ce01',
  '645dec8513806f2f54f3ce03',
  '645dec8513806f2f54f3ce05',
  '645dec8613806f2f54f3ce07',
  '645dec8713806f2f54f3ce09',
  '645dec8713806f2f54f3ce0b',
  '645dec8813806f2f54f3ce0d',
  '645dec8913806f2f54f3ce0f',
  '645dec8a13806f2f54f3ce11',
  '645dec8a13806f2f54f3ce13',
  '645dec8b13806f2f54f3ce15',
  '645dec8c13806f2f54f3ce17',
  '645dec8c13806f2f54f3ce19',
  '645dec8d13806f2f54f3ce1b',
  '645dec8e13806f2f54f3ce1d',
  '645dec8f13806f2f54f3ce1f',
  '645dec8f13806f2f54f3ce21',
  '645dec9013806f2f54f3ce23',
  '645dec9113806f2f54f3ce25',
  '645dec9113806f2f54f3ce27',
  '645dec9213806f2f54f3ce29',
  '645dec9313806f2f54f3ce2b',
  '645dec9413806f2f54f3ce2d',
  '645dec9413806f2f54f3ce2f',
  '645dec9513806f2f54f3ce31',
  '645dec9613806f2f54f3ce33',
  '645dec9713806f2f54f3ce35',
  '645dec9713806f2f54f3ce37',
  '645dec9813806f2f54f3ce39',
  '645dec9913806f2f54f3ce3b',
  '645dec9a13806f2f54f3ce3d',
  '645dec9a13806f2f54f3ce3f',
  '645dec9b13806f2f54f3ce41',
  '645dec9c13806f2f54f3ce43',
  '645dec9c13806f2f54f3ce45',
  '645dec9d13806f2f54f3ce47',
  '645dec9e13806f2f54f3ce49',
  '645dec9f13806f2f54f3ce4b',
  '645dec9f13806f2f54f3ce4d',
  '645deca013806f2f54f3ce4f',
  '645deca113806f2f54f3ce51',
  '645deca113806f2f54f3ce53',
  '645deca213806f2f54f3ce55',
  '645deca313806f2f54f3ce57',
  '645deca413806f2f54f3ce59',
  '645deca413806f2f54f3ce5b',
  '645deca513806f2f54f3ce5d',
  '645deca613806f2f54f3ce5f',
  '645deca713806f2f54f3ce61',
  '645deca813806f2f54f3ce63',
  '645deca813806f2f54f3ce65',
  '645deca913806f2f54f3ce67',
  '645decaa13806f2f54f3ce69',
  '645decab13806f2f54f3ce6b',
  '645decab13806f2f54f3ce6d',
  '645decac13806f2f54f3ce6f',
  '645decad13806f2f54f3ce71',
  '645decad13806f2f54f3ce73',
  '645decae13806f2f54f3ce75',
  '645decaf13806f2f54f3ce77',
  '645decb013806f2f54f3ce79',
  '645decb013806f2f54f3ce7b',
  '645decb113806f2f54f3ce7d',
  '645decb213806f2f54f3ce7f',
  '645decb213806f2f54f3ce81',
  '645decb313806f2f54f3ce83',
  '645decb413806f2f54f3ce85',
  '645decb513806f2f54f3ce87',
  '645decb513806f2f54f3ce89',
  '645decb613806f2f54f3ce8b',
  '645decb713806f2f54f3ce8d',
  '645decb713806f2f54f3ce8f',
  '645decb813806f2f54f3ce91',
  '645decb913806f2f54f3ce93',
  '645decba13806f2f54f3ce95',
  '645decba13806f2f54f3ce97',
  '645decf44bc2231fe8dee766',
  '645decf84bc2231fe8dee76a',
  '645decf94bc2231fe8dee76c',
  '645decfa4bc2231fe8dee76e',
  '645decfb4bc2231fe8dee770',
  '645decfb4bc2231fe8dee772',
  '645decfc4bc2231fe8dee774',
  '645decfd4bc2231fe8dee776',
  '645decfe4bc2231fe8dee778',
  '645decfe4bc2231fe8dee77a',
  '645decff4bc2231fe8dee77c',
  '645ded004bc2231fe8dee77e',
  '645ded014bc2231fe8dee780',
  '645ded014bc2231fe8dee782',
  '645ded024bc2231fe8dee784',
  '645ded034bc2231fe8dee786',
  '645ded044bc2231fe8dee788',
  '645ded044bc2231fe8dee78a',
  '645ded054bc2231fe8dee78c',
  '645ded064bc2231fe8dee78e',
  '645ded074bc2231fe8dee790',
  '645ded074bc2231fe8dee792',
  '645ded084bc2231fe8dee794',
  '645ded094bc2231fe8dee796',
  '645ded094bc2231fe8dee798',
  '645ded0a4bc2231fe8dee79a',
  '645ded0b4bc2231fe8dee79c',
  '645ded0c4bc2231fe8dee79e',
  '645ded0c4bc2231fe8dee7a0',
  '645ded0d4bc2231fe8dee7a2',
  '645ded0e4bc2231fe8dee7a4',
  '645ded0f4bc2231fe8dee7a6',
  '645ded104bc2231fe8dee7a8',
  '645ded114bc2231fe8dee7aa',
  '645ded124bc2231fe8dee7ac',
  '645ded124bc2231fe8dee7ae',
  '645ded144bc2231fe8dee7b0',
  '645ded144bc2231fe8dee7b2',
  '645ded154bc2231fe8dee7b4',
  '645ded164bc2231fe8dee7b6',
  '645ded174bc2231fe8dee7b8',
  '645ded184bc2231fe8dee7ba',
  '645ded194bc2231fe8dee7bc',
  '645ded1a4bc2231fe8dee7be',
  '645ded1b4bc2231fe8dee7c0',
  '645ded1c4bc2231fe8dee7c2',
  '645ded1d4bc2231fe8dee7c4',
  '645ded1d4bc2231fe8dee7c6',
  '645ded1e4bc2231fe8dee7c8',
  '645ded1f4bc2231fe8dee7ca',
  '645ded204bc2231fe8dee7cc',
  '645ded214bc2231fe8dee7ce',
  '645ded214bc2231fe8dee7d0',
  '645ded224bc2231fe8dee7d2',
  '645ded234bc2231fe8dee7d4',
  '645ded244bc2231fe8dee7d6',
  '645ded254bc2231fe8dee7d8',
  '645ded254bc2231fe8dee7da',
  '645ded264bc2231fe8dee7dc',
  '645ded274bc2231fe8dee7de',
  '645ded284bc2231fe8dee7e0',
  '645ded284bc2231fe8dee7e2',
  '645ded294bc2231fe8dee7e4',
  '645ded2a4bc2231fe8dee7e6',
  '645ded2b4bc2231fe8dee7e8',
  '645ded2c4bc2231fe8dee7ea',
  '645ded2d4bc2231fe8dee7ec',
  '645ded2e4bc2231fe8dee7ee',
  '645ded2f4bc2231fe8dee7f0',
  '645ded304bc2231fe8dee7f2',
  '645ded314bc2231fe8dee7f4',
  '645ded324bc2231fe8dee7f6',
  '645ded334bc2231fe8dee7f8',
  '645ded344bc2231fe8dee7fa',
  '645ded354bc2231fe8dee7fc',
  '645ded374bc2231fe8dee7fe',
  '645ded384bc2231fe8dee800',
  '645ded394bc2231fe8dee802',
  '645ded3a4bc2231fe8dee804',
  '645ded3b4bc2231fe8dee806',
  '645ded3c4bc2231fe8dee808',
  '645ded3d4bc2231fe8dee80a',
  '645ded3e4bc2231fe8dee80c',
  '645ded3f4bc2231fe8dee80e',
  '645ded404bc2231fe8dee810',
  '645ded414bc2231fe8dee812',
  '645ded424bc2231fe8dee814',
  '645ded434bc2231fe8dee816',
  '645ded444bc2231fe8dee818',
  '645ded454bc2231fe8dee81a',
  '645ded464bc2231fe8dee81c',
  '645ded464bc2231fe8dee81e',
  '645ded474bc2231fe8dee820',
  '645ded484bc2231fe8dee822',
  '645ded494bc2231fe8dee824',
  '645ded494bc2231fe8dee826',
  '645ded4a4bc2231fe8dee828',
  '645ded4b4bc2231fe8dee82a',
  '645ded4c4bc2231fe8dee82c',
  '645ded4c4bc2231fe8dee82e',
];

const createSaveTours = async (companyIds) => {
  // Generate tour data for 3000 tours
  for (let i = 1; i <= 1000; i++) {
    try {
      // Get the boundaries of a city using the OpenStreetMap API
      const cityName = faker.address.city();
      const response = await axios.get(
        `https://nominatim.openstreetmap.org/search?format=json&q=${cityName}`
      );
      const cityBounds = response.data[0].boundingbox.map(Number);

      // Generate random coordinates within the city boundary
      const randomLng = faker.datatype.number({
        min: cityBounds[2],
        max: cityBounds[3],
        precision: 0.0001,
      });
      const randomLat = faker.datatype.number({
        min: cityBounds[0],
        max: cityBounds[1],
        precision: 0.0001,
      });

      // Generate a name based on the tour location
      const name =
        faker.address.cityName() + ' ' + faker.random.word() + ' Tour';

      // generate random date between today and last year
      const today = new Date();
      const lastYear = new Date(
        today.getFullYear() - 1,
        today.getMonth(),
        today.getDate()
      );
      const randomDate = new Date(
        +lastYear + Math.random() * (today - lastYear)
      );
      // Generate a summary based on the tour location
      const summary =
        'Explore the underwater wonders of ' +
        cityName +
        ' on an unforgettable snorkeling and diving adventure.';

      // Generate a description based on the tour location
      const description =
        'Dive into the crystal-clear waters of ' +
        cityName +
        " and discover a world of vibrant marine life, colorful coral reefs, and ancient shipwrecks. Our expert guides will take you to the best snorkeling and diving spots, where you'll be surrounded by schools of tropical fish, sea turtles, and other fascinating creatures. Whether you're an experienced diver or a first-time snorkeler, we have the perfect tour for you, with options ranging from gentle snorkeling trips to thrilling deep dives. Our tours are designed to showcase the beauty and diversity of the local marine environment, while also emphasizing safety and conservation. We use state-of-the-art equipment and follow strict guidelines to ensure that you have a memorable and responsible experience. Join us for a day of adventure and exploration, and discover the hidden treasures that lie beneath the waves in " +
        cityName +
        '.';

      // Generate a random price between 50 and 8000
      const price = faker.datatype.number({ min: 50, max: 8000 });

      const tour = new Tour({
        name: name,
        summary: summary,
        description: description,
        CreatedAt: randomDate,
        image: faker.image.imageUrl(640, 480, 'nature', true, true), // generate a random nature image URL with a size of 640x480 pixels
        startLocations: {
          coordinates: [randomLng, randomLat],
          address: faker.address.streetAddress(),
          description: faker.lorem.sentence(),
        },
        locations: [
          {
            coordinates: [randomLng + 0.01, randomLat + 0.01],
            address: faker.address.streetAddress(),
            description:
              'Visit the famous ' +
              faker.random.word() +
              ' ' +
              faker.address.citySuffix() +
              ' of ' +
              faker.address.city() +
              '.',
          },
          {
            coordinates: [randomLng + 0.02, randomLat + 0.02],
            address: faker.address.streetAddress(),
            description:
              'Marvel at the stunning ' +
              faker.random.word() +
              's in the ' +
              faker.address.state() +
              ' Park.',
          },
          {
            coordinates: [randomLng + 0.03, randomLat + 0.03],
            address: faker.address.streetAddress(),
            description:
              'Relax and enjoy the breathtaking views from the top of ' +
              faker.address.cityName() +
              ' Hill.',
          },
        ],
        company: companyIds[Math.floor(Math.random() * companyIds.length)],
        price: price,
      });

      const newTour = await tour.save();

      tours.push(newTour._id);

      console.log(`Tour ${i + 1} attempted.`);
      console.log(`Tour ${tours.length} created successfully.`);
    } catch (err) {
      console.log(err);
    }
  }
  console.log(tours);
  console.log('/////////////');
  console.log(`[${tours.map((id) => `"${id}"`).join(', ')}]`);
  console.log('////////////////////');
  console.log(JSON.stringify(tours));
};

createSaveTours(companyIds);

// const fs = require('fs');

// fs.writeFile(
//   './dev-data/tours/tours.json',
//   JSON.stringify(tours),
//   function (err) {
//     if (err) {
//       console.log(err);
//     } else {
//       console.log('Tours saved to tours.json');
//     }
//   }
// );
