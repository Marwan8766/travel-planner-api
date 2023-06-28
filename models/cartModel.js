const mongoose = require('mongoose');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const Availability = require('./availabilityModel');

const cartSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  items: [
    {
      tour: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Tour',
      },
      tripProgram: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'TripProgram',
      },
      type: {
        type: String,
        enum: ['tour', 'tripProgram'],
      },
      quantity: {
        type: Number,
        required: true,
        default: 1,
        min: 1,
      },
      date: {
        type: Date,
        required: true,
      },
    },
  ],
});

cartSchema.pre('find', async function (next) {
  // Make sure the query includes the user ID
  if (!this._conditions.user) {
    return next(new AppError('User ID is missing', 400));
  }

  // Find the cart for the current user
  const cart = await this.findOne({ user: this._conditions.user });
  if (!cart) {
    return next(new AppError('Cart not found', 404));
  }

  // Loop through each item in the cart and check availability
  for (let i = 0; i < cart.items.length; i++) {
    const item = cart.items[i];

    // Find the availability document for the item and date
    const availability = await Availability.findOne({
      $or: [
        { tour: item.tour, date: item.date },
        { tripProgram: item.tripProgram, date: item.date },
      ],
    });

    // If no availability document is found or the availableSeats is less than the quantity, remove the item
    if (
      !availability ||
      availability.availableSeats < item.quantity ||
      availability.date < item.date
    ) {
      cart.items.splice(i, 1);
      i--; // decrement the index as the array is now shorter
    }
  }

  // Save the updated cart
  const updatedCart = await cart.save({ validateModifiedOnly: true });
  if (!updatedCart) {
    return next(new AppError('Error checking cart items availability', 400));
  }

  // Add the updated cart to the query and continue
  this._conditions = { user: this._conditions.user };
  this._update = { $set: updatedCart };
  next();
});

cartSchema.pre('save', function (next) {
  // Check if 'this.items' is defined and that at least one item is present in the cart
  if (!this.items || this.items.length === 0) {
    return next(new AppError('At least one item is required in the cart', 400));
  }

  // Loop through each item and validate it
  for (const item of this.items) {
    // Check that either tour or tripProgram is present
    if (!item || !(item.tour || item.tripProgram)) {
      return next(
        new AppError(
          'Either a tour or trip program is required for each item',
          400
        )
      );
    }

    // Check that only one of tour or tripProgram is present
    if (item.tour && item.tripProgram) {
      return next(
        new AppError(
          'Each item can be for either a tour or a tripProgram, but not both',
          400
        )
      );
    }

    // Set the type of the item based on the presence of tour or tripProgram
    item.type = item.tour ? 'tour' : 'tripProgram';

    // check that the date is greater than or equal to the current date
    if (item.date < Date.now()) {
      return next(
        new AppError(
          'The date for each item must be greater than or equal to the current date',
          400
        )
      );
    }
  }

  // Continue with the save operation
  next();
});

cartSchema.pre('save', async function (next) {
  // Loop over the items array
  for (let i = 0; i < this.items.length; i++) {
    const currentItem = this.items[i];

    // Check if the current item has duplicates in the items array
    const duplicates = this.items.filter(
      (item, index) => index !== i && isDuplicate(item, currentItem)
    );

    if (duplicates.length > 0) {
      // Remove the duplicates
      this.items = this.items.filter(
        (item, index) => index === i || !isDuplicate(item, currentItem)
      );

      // Increase the quantity of the current item
      currentItem.quantity += duplicates.reduce(
        (total, item) => total + item.quantity,
        0
      );
    }
  }

  next();
});

// Helper function to check if two items are duplicates
function isDuplicate(item1, item2) {
  return (
    item1.type === item2.type &&
    ((item1.tour &&
      item2.tour &&
      item1.tour.toString() === item2.tour.toString()) ||
      (item1.tripProgram &&
        item2.tripProgram &&
        item1.tripProgram.toString() === item2.tripProgram.toString())) &&
    item1.date.getTime() === item2.date.getTime()
  );
}

cartSchema.index({ user: 1 }, { unique: true });

module.exports = mongoose.model('Cart', cartSchema);
