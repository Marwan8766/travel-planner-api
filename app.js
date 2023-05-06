const express = require('express');

const AppError = require('./utils/appError');
const globalErrorHandler = require('./controllers/appErrorController');
const bookingController = require('./controllers/bookingController');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const Booking = require('./models/booking.model');

const cors = require('cors');
const app = express();

app.use(cors());

// Use body-parser to retrieve the raw body as a buffer
const bodyParser = require('body-parser');

// This is your Stripe CLI webhook secret for testing your endpoint locally.
const endpointSecret = process.env.STRIPE_ENDPOINT_SECRET;

app.use((req, res, next) => {
  console.log(`Incoming request: ${req.method} ${req.url}`);
  next();
});

app.post(
  '/webhook',
  bodyParser.raw({ type: 'application/json' }),
  async (request, response) => {
    const sig = request.headers['stripe-signature'];

    let event;

    try {
      event = stripe.webhooks.constructEvent(request.body, sig, endpointSecret);
    } catch (err) {
      response.status(400).send(`Webhook Error: ${err.message}`);
      return;
    }

    // Handle the event
    switch (event.type) {
      case 'payment_intent.succeeded':
        const paymentIntentSucceeded = event.data.object;
        const metadata = paymentIntentSucceeded.metadata;
        const paymentIntentId = paymentIntentSucceeded.id;
        // loop over metadata
        for (const [key, item] of Object.entries(metadata)) {
          // handle updating booking
          const updateBookingStatus =
            bookingController.updateBooking_stripe_webhook(
              paymentIntentId,
              item
            );
        }
        // Then define and call a function to handle the event payment_intent.succeeded
        break;
      ////////////////////////////////////////////////
      case 'payment_intent.payment_failed':
        const paymentIntentPaymentFailed = event.data.object;
        const metadata2 = paymentIntentPaymentFailed.metadata;
        const paymentIntentId2 = paymentIntentPaymentFailed.id;

        // loop over metadata
        for (const [key, item] of Object.entries(metadata)) {
          // handle updating booking
          const updateBookingStatus =
            bookingController.updateBooking_stripe_webhook_fail(
              paymentIntentId,
              item
            );
        }

        // Then define and call a function to handle the event payment_intent.payment_failed
        break;
      // ... handle other event types
      default:
        console.log(`Unhandled event type ${event.type}`);
    }

    // Return a 200 response to acknowledge receipt of the event
    response.send();
  }
);

const userRouter = require('./routes/userRoutes');
const tourRouter = require('./routes/tourRouters');
const touristAttractionsRouter = require('./routes/touristAttractionsRouter');
const plannedTripsRouter = require('./routes/plannedTripsRouter');
const cityRouter = require('./routes/cityRouter');
const reviewRouter = require('./routes/reviewRouter');
const bookingRouter = require('./routes/bookingRouter');
const tripProgramRouter = require('./routes/tripProgramRoutes');
const countryRouter = require('./routes/countryRouter');
const availabilityRouter = require('./routes/availabilityRouter');
const cartRouter = require('./routes/cartRouter');
const catchAsync = require('./utils/catchAsync');
const User = require('./models/userModel');
const plannedTripController = require('./controllers/plannedTripsController');
const Tour = require('./models/tourModel');
const TouristAttraction = require('./models/touristAttractionModel');

app.use(express.json());

app.use('/api/v1/test', async (req, res) => {
  console.log('Test route accessed!');
  const cityObj = await plannedTripController.getCityRadius('cairo');
  const { lat, lng, radius } = cityObj;
  console.log('destreuctured...');
  const tours = TouristAttraction.find({
    location: { $geoWithin: { $centerSphere: [[lng, lat], radius] } },
  });
  console.log('done');
  res.status(200).json({
    message: 'This is a test response.',
    tours,
  });
});

app.use(
  '/api/v1/testUsers',
  catchAsync(async (req, res, next) => {
    // const users = await User.find();
    const users = false;
    if (!users) return next(new AppError('error', 404));
    res.status(200).json({
      status: 'success',
      data: {
        users,
      },
    });
  })
);

// Routing
app.use('/api/v1/users', userRouter);
app.use('/api/v1/tours', tourRouter);
app.use('/api/v1/touristAttractions', touristAttractionsRouter);
app.use('/api/v1/plannedTrips', plannedTripsRouter);
app.use('/api/v1/cities', cityRouter); // not fully tested
app.use('/api/v1/countries', countryRouter); // not fully tested
app.use('/api/v1/reviews', reviewRouter);
app.use('/api/v1/booking', bookingRouter);
app.use('/api/v1/tripPrograms', tripProgramRouter);
app.use('/api/v1/availability', availabilityRouter); // not tested
app.use('/api/v1/cart', cartRouter); // not tested

app.all('*', (req, res, next) => {
  next(new AppError(`Couldn't find ${req.originalUrl} on this server!`, 400));
});

// IMPLEMENTING a global error handling middleware
app.use(globalErrorHandler);

module.exports = app;
