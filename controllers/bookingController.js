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
  const page = req.query.page * 1 || 1;
  const limit = req.query.limit * 1 || 5;
  const skip = (page - 1) * limit;
  // find all books
  const book = await bookingModel.find().skip(skip).limit(limit);
  // if there is no books throw an error
  if (book.length === 0)
    return next(new AppError('There is no books found', 404));
  // send res json with success and books
  res.status(200).json({
    status: 'success',
    page,
    data: book,
  });
});

exports.createStripeCheckoutItems = catchAsync(async (req, res, next) => {
  // find the user cart
  let cart = await cartModel.findOne({ user: req.user._id });

  if (!cart) return next(new AppError('cart not found', 404));

  // populate the tour and tripProgram fields
  cart = await cart
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
      const { name, price, company, _id } =
        type === 'tour' ? tour : tripProgram;
      const { stripeAccountId } = company;
      return {
        type: type,
        itemDate: date.toISOString(),
        companyId: company._id,
        itemId: _id,
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

    console.log(`metadata: ${JSON.stringify(metadata)}`);

    let key = 0;
    // loop over metadata items
    for (const item of metadata.items) {
      let tour = undefined;
      let tripProgram = undefined;

      console.log(`currentITemMeta: ${JSON.stringify(item)}`);
      const query = {
        date: item.itemDate,
      };

      if (item.type === 'tour') query.tour = item.itemId;
      if (item.type === 'tripProgram') query.tripProgram = item.itemId;

      if (item.type === 'tour') tour = item.itemId;
      if (item.type === 'tripProgram') tripProgram = item.itemId;

      // reserve the item from the availability
      const itemAvailability = await availabilityModel.findOne(query);

      console.log(`query: ${JSON.stringify(query)}`);

      if (!itemAvailability)
        return next(
          new AppError(
            `Sorry this item isnot available ${item.type}: ${item.name} in ${item.itemDate}`
          )
        );

      console.log(`itemAvail: ${JSON.stringify(itemAvailability)}`);
      console.log(`item: ${JSON.stringify(item)}`);

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

      metadata.items[key].bookingId = itemBooking._id;

      // if no booking created add quantity to availability and return error
      if (!itemBooking) {
        updatedItemAvailability.availableSeats =
          updatedItemAvailability.availableSeats + item.quantity;

        await updatedItemAvailability.save({ validateModifiedOnly: true });

        return next(
          new AppError(`Error while booking this item ${item.name}`, 400)
        );
      }
      key++;
    } // end of loop
    // update req.metadata with new booking IDs
    req.metadata = metadata;

    // call next
    next();
  }
);

exports.createStripePaymentSession = catchAsync(async (req, res, next) => {
  // take line_items array and metadata from the req
  const { lineItems, metadata } = req;

  // ensure that every item in metadata items is string

  console.log(`lineItems: ${JSON.stringify(lineItems)}`);
  console.log(`metadata: ${JSON.stringify(metadata)}`);

  const metadata_obj = {};
  for (let i = 0; i < metadata.items.length; i++) {
    metadata_obj[i] = `${metadata.items[
      i
    ].bookingId.toString()},${metadata.items[i].itemDate.toString()}`;
  }

  console.log(`the final metada_obj: ${JSON.stringify(metadata_obj)}`);

  // create the session
  const session = await stripe.checkout.sessions.create({
    line_items: lineItems,
    mode: 'payment',
    // success_url: `${req.protocol}://${req.get('host')}/success.html`,
    success_url: `https://travel-gate-trip-planner.netlify.app/index.html`,
    // cancel_url: `${req.protocol}://${req.get('host')}/cancel.html`,
    cancel_url: `https://travel-gate-trip-planner.netlify.app/package.html`,
    customer_email: req.user.email,
    currency: 'usd',
    payment_method_types: ['card'],
    metadata: metadata_obj,
  });

  console.log(`sessionUrl: ${session.url}`);
  console.log(`session: ${session}`);

  // send res
  res.status(200).json({ url: session.url });
});

exports.updateBooking_stripe_webhook = async (paymentIntentId, bookingId) => {
  try {
    const booking = await bookingModel.findById(bookingId);

    // update the booking
    booking.stripePaymentIntentId = paymentIntentId;
    booking.paid = true;
    booking.status = 'reserved';

    const updatedBooking = await booking.save({ validateModifiedOnly: true });

    const cart = await cartModel.findOne({ user: booking.user });
    cart.items = [];
    await cart.save({ validateModifiedOnly: true });

    console.log(`updatedSuccessBooking: ${JSON.stringify(updatedBooking)}`);
    return 'success';
  } catch (err) {
    console.log('updateBooking_stripe_webhook error', err);
    return 'error';
  }
};

exports.updateBooking_stripe_webhook_fail = async (
  paymentIntentId,
  bookingId,
  itemDate
) => {
  try {
    const booking = await bookingModel.findById(bookingId);

    let availability;
    if (booking.tour) {
      availability = await availabilityModel.findOne({
        tour: booking.tour,
        date: itemDate,
      });
    } else if (booking.tripProgram === 'tripProgram') {
      availability = await availabilityModel.findOne({
        tripProgram: booking.tripProgram,
        date: itemDate,
      });
    }

    availability.availableSeats =
      availability.availableSeats + booking.quantity;

    await availability.save({ validateModifiedOnly: true });

    console.log(`itemBooking.Id fail: ${bookingId}`);

    const cart = await cartModel.findOne({ user: booking.user });
    cart.items = [];
    await cart.save({ validateModifiedOnly: true });

    await bookingModel.findByIdAndDelete(bookingId);
  } catch (err) {
    console.log(`updateBooking_stripe_webhook_fail ${paymentIntentId}`, err);
  }
};

/////////////////////////////////////////////
/////////////////////////////////////////////
/////////////////////////////////////////////
// Dashboard
///////////////////////

exports.getAllbooksLastThreeMonths = catchAsync(async (req, res, next) => {
  const book = await bookingModel.aggregate([
    {
      $match: {
        updatedAt: {
          $gte: new Date(new Date().setMonth(new Date().getMonth() - 3)),
        },
        status: 'reserved',
      },
    },

    {
      $project: {
        month: { $month: '$updatedAt' },
        result: { $sum: 1 },
      },
    },
    {
      $group: {
        _id: '$month',
        monthName: {
          $first: {
            $switch: {
              branches: [
                { case: { $eq: ['$month', 1] }, then: 'January' },
                { case: { $eq: ['$month', 2] }, then: 'February' },
                { case: { $eq: ['$month', 3] }, then: 'March' },
                { case: { $eq: ['$month', 4] }, then: 'April' },
                { case: { $eq: ['$month', 5] }, then: 'May' },
                { case: { $eq: ['$month', 6] }, then: 'June' },
                { case: { $eq: ['$month', 7] }, then: 'July' },
                { case: { $eq: ['$month', 8] }, then: 'August' },
                { case: { $eq: ['$month', 9] }, then: 'September' },
                { case: { $eq: ['$month', 10] }, then: 'October' },
                { case: { $eq: ['$month', 11] }, then: 'November' },
                { case: { $eq: ['$month', 12] }, then: 'December' },
              ],
              default: 'Unknown',
            },
          },
        },
        totalResult: { $sum: '$result' },
      },
    },
    {
      $match: {
        _id: { $ne: new Date().getMonth() + 1 },
      },
    },
    {
      $sort: { _id: 1 },
    },
    {
      $group: {
        _id: null,
        months: { $push: '$monthName' },
        totalResults: { $push: '$totalResult' },
      },
    },
    {
      $project: {
        _id: 0,
        months: 1,
        totalResults: 1,
      },
    },
  ]);
  // if there is no books throw an error
  if (book.length === 0)
    return next(new AppError('There is no books found', 404));
  // send res json with success and books
  res.status(200).json({
    status: 'success',
    data: book,
  });
});

exports.getAllbooksLastSixMonths = catchAsync(async (req, res, next) => {
  // find all books
  const book = await bookingModel.aggregate([
    {
      $match: {
        updatedAt: {
          $gte: new Date(new Date().setMonth(new Date().getMonth() - 6)),
        },
        status: 'reserved',
      },
    },

    {
      $project: {
        month: { $month: '$updatedAt' },
        result: { $sum: 1 },
      },
    },
    {
      $group: {
        _id: '$month',
        monthName: {
          $first: {
            $switch: {
              branches: [
                { case: { $eq: ['$month', 1] }, then: 'January' },
                { case: { $eq: ['$month', 2] }, then: 'February' },
                { case: { $eq: ['$month', 3] }, then: 'March' },
                { case: { $eq: ['$month', 4] }, then: 'April' },
                { case: { $eq: ['$month', 5] }, then: 'May' },
                { case: { $eq: ['$month', 6] }, then: 'June' },
                { case: { $eq: ['$month', 7] }, then: 'July' },
                { case: { $eq: ['$month', 8] }, then: 'August' },
                { case: { $eq: ['$month', 9] }, then: 'September' },
                { case: { $eq: ['$month', 10] }, then: 'October' },
                { case: { $eq: ['$month', 11] }, then: 'November' },
                { case: { $eq: ['$month', 12] }, then: 'December' },
                // Add more cases for the remaining months
              ],
              default: 'Unknown',
            },
          },
        },
        totalResult: { $sum: '$result' },
      },
    },
    {
      $match: {
        _id: { $ne: new Date().getMonth() + 1 },
      },
    },
    {
      $sort: { _id: 1 },
    },
    {
      $group: {
        _id: null,
        months: { $push: '$monthName' },
        totalResults: { $push: '$totalResult' },
      },
    },
    {
      $project: {
        _id: 0,
        months: 1,
        totalResults: 1,
      },
    },
  ]);
  // if there is no books throw an error
  if (book.length === 0)
    return next(new AppError('There is no books found', 404));
  // send res json with success and books
  res.status(200).json({
    status: 'success',
    data: book,
  });
});

exports.getAllbooksLastYear = catchAsync(async (req, res, next) => {
  const book = await bookingModel.aggregate([
    {
      $match: {
        updatedAt: {
          $gte: new Date(new Date().setMonth(new Date().getMonth() - 12)),
        },
        status: 'reserved',
      },
    },

    {
      $project: {
        month: { $month: '$updatedAt' },
        result: { $sum: 1 },
      },
    },
    {
      $group: {
        _id: '$month',
        monthName: {
          $first: {
            $switch: {
              branches: [
                { case: { $eq: ['$month', 1] }, then: 'January' },
                { case: { $eq: ['$month', 2] }, then: 'February' },
                { case: { $eq: ['$month', 3] }, then: 'March' },
                { case: { $eq: ['$month', 4] }, then: 'April' },
                { case: { $eq: ['$month', 5] }, then: 'May' },
                { case: { $eq: ['$month', 6] }, then: 'June' },
                { case: { $eq: ['$month', 7] }, then: 'July' },
                { case: { $eq: ['$month', 8] }, then: 'August' },
                { case: { $eq: ['$month', 9] }, then: 'September' },
                { case: { $eq: ['$month', 10] }, then: 'October' },
                { case: { $eq: ['$month', 11] }, then: 'November' },
                { case: { $eq: ['$month', 12] }, then: 'December' },
                // Add more cases for the remaining months
              ],
              default: 'Unknown',
            },
          },
        },
        totalResult: { $sum: '$result' },
      },
    },
    {
      $match: {
        _id: { $ne: new Date().getMonth() + 1 },
      },
    },
    {
      $sort: { _id: 1 },
    },
    {
      $group: {
        _id: null,
        months: { $push: '$monthName' },
        totalResults: { $push: '$totalResult' },
      },
    },
    {
      $project: {
        _id: 0,
        months: 1,
        totalResults: 1,
      },
    },
  ]);
  // if there is no books throw an error
  if (book.length === 0)
    return next(new AppError('There is no books found', 404));
  // send res json with success and books
  res.status(200).json({
    status: 'success',
    data: book,
  });
});

exports.getTheBestFiveTour_InLastThreeMonths = catchAsync(
  async (req, res, next) => {
    const aggregation = [
      {
        $match: {
          updatedAt: {
            $gte: new Date(new Date().setMonth(new Date().getMonth() - 3)),
          },
          status: 'reserved',
          tour: { $exists: true },
        },
      },
      { $project: { _id: 0, tour: 1, quantity: 1, company: 1 } },
      {
        $group: {
          _id: '$tour',
          totalQuantity: { $sum: '$quantity' },
          company: { $first: '$company' },
        },
      },
      { $sort: { totalQuantity: -1 } },
      { $limit: 5 },
    ];

    const book = await bookingModel.aggregate(aggregation);

    const tourIds = book.map((item) => item._id);

    const tourData = await tourModel.find({ _id: { $in: tourIds } });

    const companyIds = book.map((item) => item.company);

    const companyData = await User.find({ _id: { $in: companyIds } });

    const tourNameMap = {};
    const companyNameMap = {};

    tourData.forEach((tour) => {
      tourNameMap[tour._id.toString()] = tour.name;
    });

    companyData.forEach((company) => {
      companyNameMap[company._id.toString()] = company.name;
    });

    const result = book.map((item) => {
      const tourName = tourNameMap[item._id.toString()];
      const companyName = companyNameMap[item.company.toString()] || '';
      return {
        tourName: tourName,
        companyName: companyName,
        totalQuantity: item.totalQuantity,
      };
    });

    if (result.length === 0)
      return next(new AppError('There are no books found', 404));

    res.status(200).json({
      status: 'success',
      results: result.length,
      data: result,
    });
  }
);

exports.getTheBestFiveTour_InLastSixMonths = catchAsync(
  async (req, res, next) => {
    const aggregation = [
      {
        $match: {
          updatedAt: {
            $gte: new Date(new Date().setMonth(new Date().getMonth() - 6)),
          },
          status: 'reserved',
          tour: { $exists: true },
        },
      },
      { $project: { _id: 0, tour: 1, quantity: 1, company: 1 } },
      {
        $group: {
          _id: '$tour',
          totalQuantity: { $sum: '$quantity' },
          company: { $first: '$company' },
        },
      },
      { $sort: { totalQuantity: -1 } },
      { $limit: 5 },
    ];

    const book = await bookingModel.aggregate(aggregation);

    const tourIds = book.map((item) => item._id);

    const tourData = await tourModel.find({ _id: { $in: tourIds } });

    const companyIds = book.map((item) => item.company);

    const companyData = await User.find({ _id: { $in: companyIds } });

    const tourNameMap = {};
    const companyNameMap = {};

    tourData.forEach((tour) => {
      tourNameMap[tour._id.toString()] = tour.name;
    });

    companyData.forEach((company) => {
      companyNameMap[company._id.toString()] = company.name;
    });

    const result = book.map((item) => {
      const tourName = tourNameMap[item._id.toString()];
      const companyName = companyNameMap[item.company.toString()] || '';
      return {
        tourName: tourName,
        companyName: companyName,
        totalQuantity: item.totalQuantity,
      };
    });

    if (result.length === 0)
      return next(new AppError('There are no books found', 404));

    res.status(200).json({
      status: 'success',
      results: result.length,
      data: result,
    });
  }
);

exports.getTheBestFiveTour_InLastYear = catchAsync(async (req, res, next) => {
  const aggregation = [
    {
      $match: {
        updatedAt: {
          $gte: new Date(new Date().setFullYear(new Date().getFullYear() - 1)),
        },
        status: 'reserved',
        tour: { $exists: true },
      },
    },
    { $project: { _id: 0, tour: 1, quantity: 1, company: 1 } },
    {
      $group: {
        _id: '$tour',
        totalQuantity: { $sum: '$quantity' },
        company: { $first: '$company' },
      },
    },
    { $sort: { totalQuantity: -1 } },
    { $limit: 5 },
  ];

  const book = await bookingModel.aggregate(aggregation);

  const tourIds = book.map((item) => item._id);

  const tourData = await tourModel.find({ _id: { $in: tourIds } });

  const companyIds = book.map((item) => item.company);

  const companyData = await User.find({ _id: { $in: companyIds } });

  const tourNameMap = {};
  const companyNameMap = {};

  tourData.forEach((tour) => {
    tourNameMap[tour._id.toString()] = tour.name;
  });

  companyData.forEach((company) => {
    companyNameMap[company._id.toString()] = company.name;
  });

  const result = book.map((item) => {
    const tourName = tourNameMap[item._id.toString()];
    const companyName = companyNameMap[item.company.toString()] || '';
    return {
      tourName: tourName,
      companyName: companyName,
      totalQuantity: item.totalQuantity,
    };
  });

  if (result.length === 0)
    return next(new AppError('There are no books found', 404));

  res.status(200).json({
    status: 'success',
    results: result.length,
    data: result,
  });
});

exports.getTheBestFiveTripProgram_InLastThreeMonths = catchAsync(
  async (req, res, next) => {
    const aggregation = [
      {
        $match: {
          updatedAt: {
            $gte: new Date(new Date().setMonth(new Date().getMonth() - 3)),
          },
          status: 'reserved',
          tripProgram: { $exists: true },
        },
      },
      { $project: { _id: 0, tripProgram: 1, quantity: 1, company: 1 } },
      {
        $group: {
          _id: '$tripProgram',
          totalQuantity: { $sum: '$quantity' },
          company: { $first: '$company' },
        },
      },
      { $sort: { totalQuantity: -1 } },
      { $limit: 5 },
    ];

    const book = await bookingModel.aggregate(aggregation);

    const tripProgramIds = book.map((item) => item._id);

    const tripProgramData = await tripProgramModel.find({
      _id: { $in: tripProgramIds },
    });

    const companyIds = book.map((item) => item.company);

    const companyData = await User.find({ _id: { $in: companyIds } });

    const tripProgramNameMap = {};
    const companyNameMap = {};

    tripProgramData.forEach((tripProgram) => {
      tripProgramNameMap[tripProgram._id.toString()] = tripProgram.name;
    });

    companyData.forEach((company) => {
      companyNameMap[company._id.toString()] = company.name;
    });

    const result = book.map((item) => {
      const tripProgramName = tripProgramNameMap[item._id.toString()];
      const companyName = companyNameMap[item.company.toString()] || '';
      return {
        tripProgramName: tripProgramName,
        companyName: companyName,
        totalQuantity: item.totalQuantity,
      };
    });

    if (result.length === 0)
      return next(new AppError('There are no books found', 404));

    res.status(200).json({
      status: 'success',
      results: result.length,
      data: result,
    });
  }
);

exports.getTheBestFiveTripProgram_InLastSixMonths = catchAsync(
  async (req, res, next) => {
    const aggregation = [
      {
        $match: {
          updatedAt: {
            $gte: new Date(new Date().setMonth(new Date().getMonth() - 6)),
          },
          status: 'reserved',
          tripProgram: { $exists: true },
        },
      },
      { $project: { _id: 0, tripProgram: 1, quantity: 1, company: 1 } },
      {
        $group: {
          _id: '$tripProgram',
          totalQuantity: { $sum: '$quantity' },
          company: { $first: '$company' },
        },
      },
      { $sort: { totalQuantity: -1 } },
      { $limit: 5 },
    ];

    const book = await bookingModel.aggregate(aggregation);

    const tripProgramIds = book.map((item) => item._id);

    const tripProgramData = await tripProgramModel.find({
      _id: { $in: tripProgramIds },
    });

    const companyIds = book.map((item) => item.company);

    const companyData = await User.find({ _id: { $in: companyIds } });

    const tripProgramNameMap = {};
    const companyNameMap = {};

    tripProgramData.forEach((tripProgram) => {
      tripProgramNameMap[tripProgram._id.toString()] = tripProgram.name;
    });

    companyData.forEach((company) => {
      companyNameMap[company._id.toString()] = company.name;
    });

    const result = book.map((item) => {
      const tripProgramName = tripProgramNameMap[item._id.toString()];
      const companyName = companyNameMap[item.company.toString()] || '';
      return {
        tripProgramName: tripProgramName,
        companyName: companyName,
        totalQuantity: item.totalQuantity,
      };
    });

    if (result.length === 0)
      return next(new AppError('There are no books found', 404));

    res.status(200).json({
      status: 'success',
      results: result.length,
      data: result,
    });
  }
);

exports.getTheBestFiveTripProgram_InLastYear = catchAsync(
  async (req, res, next) => {
    const aggregation = [
      {
        $match: {
          updatedAt: {
            $gte: new Date(
              new Date().setFullYear(new Date().getFullYear() - 1)
            ),
          },
          status: 'reserved',
          tripProgram: { $exists: true },
        },
      },
      { $project: { _id: 0, tripProgram: 1, quantity: 1, company: 1 } },
      {
        $group: {
          _id: '$tripProgram',
          totalQuantity: { $sum: '$quantity' },
          company: { $first: '$company' },
        },
      },
      { $sort: { totalQuantity: -1 } },
      { $limit: 5 },
    ];

    const book = await bookingModel.aggregate(aggregation);

    const tripProgramIds = book.map((item) => item._id);

    const tripProgramData = await tripProgramModel.find({
      _id: { $in: tripProgramIds },
    });

    const companyIds = book.map((item) => item.company);

    const companyData = await User.find({ _id: { $in: companyIds } });

    const tripProgramNameMap = {};
    const companyNameMap = {};

    tripProgramData.forEach((tripProgram) => {
      tripProgramNameMap[tripProgram._id.toString()] = tripProgram.name;
    });

    companyData.forEach((company) => {
      companyNameMap[company._id.toString()] = company.name;
    });

    const result = book.map((item) => {
      const tripProgramName = tripProgramNameMap[item._id.toString()];
      const companyName = companyNameMap[item.company.toString()] || '';
      return {
        tripProgramName: tripProgramName,
        companyName: companyName,
        totalQuantity: item.totalQuantity,
      };
    });

    if (result.length === 0)
      return next(new AppError('There are no books found', 404));

    res.status(200).json({
      status: 'success',
      results: result.length,
      data: result,
    });
  }
);

exports.getTheTrendingCountries = catchAsync(async (req, res, next) => {
  const aggregation = [
    {
      $match: {
        updatedAt: {
          $gte: new Date(new Date().setMonth(new Date().getMonth() - 1)),
        },
        status: 'reserved',
        tour: { $exists: true },
      },
    },
    { $project: { _id: 0, tour: 1, quantity: 1 } },
    {
      $group: {
        _id: '$tour',
        totalQuantity: { $sum: '$quantity' },
      },
    },
    { $sort: { totalQuantity: -1 } },
    { $limit: 5 },
  ];

  const book = await bookingModel.aggregate(aggregation);

  const tourIds = book.map((item) => item._id);

  const tourData = await tourModel.find({ _id: { $in: tourIds } });

  const countryNameMap = {};
  const startLocationCoordsMap = {};

  tourData.forEach((tour) => {
    countryNameMap[tour._id.toString()] = tour.startLocations.country;
    startLocationCoordsMap[tour._id.toString()] =
      tour.startLocations.coordinates.map((coord) => [coord[1], coord[0]]);
  });

  const result = book.map((item) => {
    const countryNames = countryNameMap[item._id.toString()] || [];
    const startLocationCoords =
      startLocationCoordsMap[item._id.toString()] || [];

    return {
      countryNames: countryNames,
      coords: startLocationCoords,
    };
  });

  if (result.length === 0)
    return next(new AppError('There are no books found', 404));

  res.status(200).json({
    status: 'success',
    results: result.length,
    data: result,
  });
});

exports.getTheTenTourIsTrending = catchAsync(async (req, res, next) => {
  const aggregation = [
    {
      $match: {
        updatedAt: {
          $gte: new Date(new Date().setMonth(new Date().getMonth() - 1)),
        },
        status: 'reserved',
        tour: { $exists: true },
      },
    },
    { $project: { _id: 0, tour: 1, quantity: 1 } },
    {
      $group: {
        _id: '$tour',
        totalQuantity: { $sum: '$quantity' },
        company: { $first: '$company' },
      },
    },
    { $sort: { totalQuantity: -1 } },
    { $limit: 10 },
  ];

  const book = await bookingModel.aggregate(aggregation);

  const tourIds = book.map((item) => item._id);

  const tourData = await tourModel.find({ _id: { $in: tourIds } });

  res.status(200).json({
    status: 'success',
    results: tourData.length,
    data: tourData,
  });
});
exports.getTheTenTripProgramIsTrending = catchAsync(async (req, res, next) => {
  const aggregation = [
    {
      $match: {
        updatedAt: {
          $gte: new Date(new Date().setMonth(new Date().getMonth() - 1)),
        },
        status: 'reserved',
        tripProgram: { $exists: true },
      },
    },
    { $project: { _id: 0, tripProgram: 1, quantity: 1 } },
    {
      $group: {
        _id: '$tripProgram',
        totalQuantity: { $sum: '$quantity' },
      },
    },
    { $sort: { totalQuantity: -1 } },
    { $limit: 10 },
  ];

  const book = await bookingModel.aggregate(aggregation);

  const tripProgramIds = book.map((item) => item._id);

  const tripProgramData = await tripProgramModel.find({
    _id: { $in: tripProgramIds },
  });

  res.status(200).json({
    status: 'success',
    results: tripProgramData.length,
    data: tripProgramData,
  });
});
