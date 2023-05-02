const mongoose = require('mongoose');
const validator = require('validator');
// const User = require('./userModel.js')

const tourSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'A tour must have a name'],
      unique: true,
      trim: true,
      maxlength: [40, 'tour name must less or equal 40 characters '],
      minlength: [10, 'tour name must more or equal 10 characters '],
      // validate : [validator.isAlpha , 'tour name must be contain only characters']
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
    price: {
      type: Number,
      required: [true, 'A tour must have a price'],
    },

    summary: {
      type: String,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
      required: [true, 'A tour must have a decription'],
    },
    image: String,
    CreatedAt: {
      type: Date,
      default: Date.now(),
      select: false,
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
    company: {
      type: mongoose.Schema.ObjectId,
      ref: 'User',
    },
  },
  {
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

tourSchema.index({ price: 1, ratingsAverage: -1 });
tourSchema.index({ startLocation: '2dsphere' });


// virtual population
tourSchema.virtual('reviews', {
  ref: 'Review',
  foreignField: 'tour',
  localField: '_id',
});

const Tour = mongoose.model('Tour', tourSchema);
module.exports = Tour;
