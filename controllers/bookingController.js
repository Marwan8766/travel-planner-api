const tripProgramModel = require('../models/tripProgramsmodel');
const tourModel = require('../models/tourModel');
const bookingModel = require('../models/booking.model');
const availabilityModel = require('../models/availabilityModel');
const User = require('../models/userModel');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const Factory = require('./handlerFactory');
const cartModel = require('../models/cartModel');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

exports.createTourBook = catchAsync(async (req, res, next) => {
  const tourId = req.params.id;
  const tour = await tourModel.findOne({ _id: tourId });
  if (!tour) {
    return next(new AppError('Tour not found', 404));
  }
  try {
    const booking = await bookingModel.create({
      bookedTour: tourId,
      user: req.user._id,
      price: tour.price,
    });
    if (!booking) {
      return next(new AppError('Could not create book', 400));
    }
    res.status(200).json({
      status: 'success',
      data: {
        booking,
      },
    });
  } catch (err) {
    return next(
      new AppError(`Could not upload this book: ${err.message}`, 400)
    );
  }
});

exports.createTripProgramBook = catchAsync(async (req, res, next) => {
  const tripProgramId = req.params.id;
  const tripProgram = await tripProgramModel.findOne({ _id: tripProgramId });
  if (!tripProgram) {
    return next(new AppError('tripProgram not found', 404));
  }
  try {
    const booking = await bookingModel.create({
      bookedTripProgram: tripProgramId,
      user: req.user._id,
      price: tripProgram.price,
    });
    if (!booking) {
      return next(new AppError('Could not create tripProgram', 400));
    }
    res.status(200).json({
      status: 'success',
      data: {
        tripProgram,
      },
    });
  } catch (err) {
    return next(
      new AppError(`Could not upload this tripProgram: ${err.message}`, 400)
    );
  }
});

exports.deleteBook = catchAsync(async (req, res, next) => {
  // find the book
  const book = await bookingModel.findById(req.params.id);
  // if no book was found throw  an rror
  if (!book) return next(new AppError("This booking could't be found", 404));

  // find the book and delete it from DB
  const deletedbook = await bookingModel.findByIdAndDelete(req.params.id);

  // if no book was found throw error
  if (!deletedbook) return next(new AppError("This booking wasn't found", 404));

  // send res json with success message and deleted book
  res.status(204).json({
    status: 'success',
    data: null,
  });
});

exports.getAllbooks = catchAsync(async (req, res, next) => {
  // find all books
  const book = await bookingModel.find();
  // if there is no books throw an error
  if (book.length === 0)
    return next(new AppError('There is no books found', 404));
  // send res json with success and books
  res.status(200).json({
    status: 'success',
    data: book,
  });
});

exports.createStripeCheckoutItems = catchAsync(async (req, res, next) => {
  // find the user cart
  const cart = await cartModel.findOne({ user: req.user._id });

  if (!cart) return next(new AppError('cart not found', 404));

  // populate the tour and tripProgram fields
  await cart
    .populate({
      path: 'items.tour',
      select: 'name price company',
      populate: {
        path: 'company',
        select: 'stripeAccountId',
      },
    })
    .populate({
      path: 'items.tripProgram',
      select: 'name price company',
      populate: {
        path: 'company',
        select: 'stripeAccountId name',
      },
    })
    .execPopulate();

  // map the items array to an array with price and quantity
  const lineItems = cart.items.map((item) => {
    const { tour, tripProgram, type, quantity, date } = item;
    const { name, price, company } = type === 'tour' ? tour : tripProgram;
    const { stripeAccountId } = company;
    return {
      price_data: {
        currency: 'usd',
        unit_amount: price * 100,
        product_data: {
          name: name,
          description: `Company: ${company.name} , Date: ${date.toISOString()}`,
        },
      },
      quantity: quantity,
    };
  });

  // create metadata object with all items data
  const metadata = {
    items: cart.items.map((item) => {
      const { tour, tripProgram, type, quantity, date } = item;
      const {
        name,
        price,
        company,
        id: _id,
      } = type === 'tour' ? tour : tripProgram;
      const { stripeAccountId } = company;
      return {
        type: type,
        itemDate: date.toISOString(),
        companyId: company._id,
        itemId: id,
        itemPrice: price,
        quantity: quantity,
        companyStripeId: stripeAccountId,
        name,
      };
    }),
  };

  // put them on req and call next
  req.lineItems = lineItems;
  req.metadata = metadata;
  next();
});

exports.createStripeCheckoutItemsBooking = catchAsync(
  async (req, res, next) => {
    const metadata = req.metadata;

    // loop over metadata items
    for (const [key, item] of Object.entries(metadata)) {
      let tour = undefined;
      let tripProgram = undefined;

      if (item.type === 'tour') tour = item.itemId;
      if (item.type === 'tripProgram') tripProgram = item.itemId;

      // reserve the item from the availability
      const itemAvailability = await availabilityModel.findOne({
        tour,
        tripProgram,
        date: item.itemDate,
      });

      itemAvailability.availableSeats =
        itemAvailability.availableSeats - item.quantity;

      const updatedItemAvailability = await itemAvailability.save({
        validateModifiedOnly: true,
      });

      if (!updatedItemAvailability)
        return next(
          new AppError(`sorry this item became unavailable ${item.name}`, 404)
        );

      // create a pending booking for each item
      const itemBooking = await bookingModel.create({
        paid: false,
        status: 'pending',
        price: item.itemPrice,
        tour,
        tripProgram,
        company: item.companyId,
        quantity: item.quantity,
        user: req.user._id,
      });

      metadata[key].bookingId = itemBooking._id;

      // if no booking created add quantity to availability and return error
      if (!itemBooking) {
        updatedItemAvailability.availableSeats =
          updatedItemAvailability.availableSeats + item.quantity;

        await updatedItemAvailability.save({ validateModifiedOnly: true });

        return next(
          new AppError(`Error while booking this item ${item.name}`, 400)
        );
      }
    }
    // update req.metadata with new booking IDs
    req.metadata = metadata;

    // call next
    next();
  }
);

exports.createStripePaymentSession = catchAsync(async (req, res, next) => {
  // take line_items array and metadata from the req
  const { line_items_array, metadata_obj } = req.body;

  // create the session
  const session = await stripe.checkout.sessions.create({
    line_items: line_items_array,
    mode: 'payment',
    success_url: `${req.protocol}://${req.get('host')}/success.html`,
    cancel_url: `${req.protocol}://${req.get('host')}/cancel.html`,
    receipt_email: req.user.email,
    currency: 'usd',
    payment_method_types: ['card'],
    metadata: metadata_obj,
  });

  // send res
  res.redirect(303, session.url);
});

exports.updateBooking_stripe_webhook = async (paymentIntentId, item) => {
  try {
    const booking = await bookingModel.findById(item.bookingId);

    // update the booking
    booking.stripePaymentIntentId = paymentIntentId;
    booking.paid = true;
    booking.status = 'reserved';

    const updatedBooking = await booking.save({ validateModifiedOnly: true });

    return 'success';
  } catch (err) {
    console.log('updateBooking_stripe_webhook error', err);
    return 'error';
  }
};

exports.updateBooking_stripe_webhook_fail = async (paymentIntentId, item) => {
  try {
    const booking = await bookingModel.findById(item.bookingId);

    let availability;
    if (item.type === 'tour') {
      availability = await availabilityModel.findOne({
        tour: item.itemId,
        date: item.itemDate,
      });
    } else if (item.type === 'tripProgram') {
      availability = await availabilityModel.findOne({
        tripProgram: item.itemId,
        date: item.itemDate,
      });
    }

    availability.availableSeats =
      availability.availableSeats + booking.quantity;

    await availability.save({ validateModifiedOnly: true });

    await bookingModel.findByIdAndDelete(item.bookingId);
  } catch (err) {
    console.log(`updateBooking_stripe_webhook_fail ${paymentIntentId}`, err);
  }
};
