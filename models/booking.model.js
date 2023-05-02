const mongoose = require('mongoose');
const AppError = require('../utils/appError');

const booking = new mongoose.Schema({
  paid: {
    type: Boolean,
    default: false,
  },
  status: {
    type: String,
    required: [true, 'A booking must have status'],
    enum: ['reserved', 'pending'],
  },
  price: {
    type: Number,
    required: [true, 'A booking must have a price'],
  },
  CreatedAt: {
    type: Date,
    default: Date.now(),
    select: false,
  },
  updatedAt: {
    type: Date,
    default: Date.now(),
    select: false,
  },
  tour: [
    {
      type: mongoose.Schema.ObjectId,
      ref: 'Tour',
      required: false,
    },
  ],
  tripProgram: {
    type: mongoose.Schema.ObjectId,
    ref: 'TripProgram',
    required: false,
  },
  company: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    required: [true, 'A booking must have a company id'],
  },
  user: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    required: [true, 'A booking must have a user id'],
  },
  stripePaymentIntentId: String,
  quantity: {
    type: Number,
    required: [true, 'A booking must have a quantity'],
  },
});

booking.pre('save', function (next) {
  if ((!this.tour && !this.tripProgram) || (this.tour && this.tripProgram))
    return next(
      new AppError('A booking must have either a tour or a tripProgram', 400)
    );

  next();
});

const Booking = mongoose.model('Booking', booking);
module.exports = Booking;
