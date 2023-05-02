const mongoose = require('mongoose');
const validator = require('validator');
const Tour = require('./tourModel');

const tripProgram = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Please write your name'],
  },
  price: {
    type: Number,
    required: [true, 'A trip must have a price'],
  },
  summary: {
    type: String,
    trim: true,
    select: true,
  },
  description: {
    type: String,
    trim: true,
    required: [true, 'A trip must have a descrption'],
    select: true,
  },
  image: String,
  CreatedAt: {
    type: Date,
    default: Date.now(),
    select: false,
  },
  ratingsAverage: {
    type: Number,
    default: 4.5,
    min: [1, 'rating avg must be above 1.0'],
    max: [5, 'rating avg must be below 5.0'],
    set: (val) => Math.round(val * 10) / 10, // 4.666 , 64.6 , 47 , 4.7
  },
  ratingsQuantity: {
    type: Number,
    default: 0,
  },
  startLocations: {
    type: {
      type: String,
      default: 'point',
      enum: ['point'],
    },
    coordinates: [Number],
    address: String,
    description: String,
  },
  locations: [
    {
      type: {
        type: String,
        default: 'Point',
        enum: ['Point'],
      },
      coordinates: [Number],
      address: String,
      description: String,
      day: Number,
    },
  ],
  tour: [
    {
      type: mongoose.Schema.ObjectId,
      ref: 'Tour',
      required: [true, 'Program must belong to a tour'],
    },
  ],
  company: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    required: [true, 'program must belong to a company'],
  },
});


tripProgram.pre(/^find/, function(next) {
  this.populate({
    path: 'tour',
    select: '-__v',
  });

  next();
});


const TripProgram = mongoose.model('TripProgram', tripProgram);
module.exports = TripProgram;
