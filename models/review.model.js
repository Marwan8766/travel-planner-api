const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema(
  {
    image: {
      type: String,
    },
    description: {
      type: String,
      required: [true, 'Review must contain description'],
    },
    rating: {
      type: Number,
      default: 4.5,
      min: [1, 'rating avg must be above 1.0'],
      max: [5, 'rating avg must be below 5.0'],
      set: (val) => Math.round(val * 10) / 10, // 4.666 , 64.6 , 47 , 4.7
    },
    tour:[ {
      type: mongoose.Schema.ObjectId,
      ref: 'Tour',
    }],
    user: {
      type: mongoose.Schema.ObjectId,
      ref: 'User',
      required: [true, 'review must belong to a user'],
    },
    company: {
      type: mongoose.Schema.ObjectId,
      ref: 'User',
    },
    tripProgram: {
      type: mongoose.Schema.ObjectId,
      ref: 'TripProgram',
    },
  },
  {
    timestamps: true,
  }
);

const reviewModel = mongoose.model('reviewModel', reviewSchema);
module.exports = reviewModel;
