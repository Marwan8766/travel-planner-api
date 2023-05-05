const mongoose = require('mongoose');
const tourModel = require('./tourModel');
const tripProgramModel = require('./tripProgramsmodel');
const userModel = require('./userModel');
const AppError = require('../utils/appError');

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
    tour: [
      {
        type: mongoose.Schema.ObjectId,
        ref: 'Tour',
      },
    ],
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
reviewSchema.index(
  {
    user: 1,
    $or: [
      { tour: { $exists: true } },
      { tripProgram: { $exists: true } },
      { company: { $exists: true } },
    ],
  },
  { unique: true }
);

reviewSchema.pre('save', function (next) {
  // Check that the review belongs to only one of tour, tripProgram, or company
  if (
    (this.tour && (this.tripProgram || this.company)) ||
    (this.tripProgram && (this.tour || this.company)) ||
    (this.company && (this.tour || this.tripProgram))
  ) {
    return next(
      new AppError(
        'A review must belong only to one of tour, tripProgram, or company'
      )
    );
  }

  // Check that the review has a value for at least one of tour, tripProgram, or company
  if (!this.tour && !this.tripProgram && !this.company) {
    return next(
      new AppError(
        'A review must have a value for at least one of tour, tripProgram, or company'
      )
    );
  }

  // Check that the review does not have a value for more than one of tour, tripProgram, or company
  const fields = [this.tour, this.tripProgram, this.company].filter(Boolean);
  if (fields.length > 1) {
    return next(
      new AppError(
        'A review cannot have a value for more than one of tour, tripProgram, or company'
      )
    );
  }

  next();
});

reviewSchema.statics.calcAvgRatingsTour = async function (tourId) {
  const stats = await this.aggregate([
    {
      $match: { tour: tourId },
    },
    {
      $group: {
        _id: '$tour',
        nRating: { $sum: 1 },
        avgRating: { $avg: '$rating' },
      },
    },
  ]);

  const tour = await tourModel.findById(tourId);

  if (stats.length > 0) {
    tour.ratingsQuantity = stats[0].nRating;
    tour.ratingsAverage = stats[0].avgRating;
  } else {
    tour.ratingsQuantity = 0;
    tour.ratingsAverage = 4.5;
  }

  await tour.save({ validateModifiedOnly: true });
};

reviewSchema.statics.calcAvgRatingsTripProgram = async function (
  tripProgramId
) {
  const stats = await this.aggregate([
    {
      $match: { tripProgram: tripProgramId },
    },
    {
      $group: {
        _id: '$tripProgram',
        nRating: { $sum: 1 },
        avgRating: { $avg: '$rating' },
      },
    },
  ]);

  const tripProgram = await tripProgramModel.findById(tripProgramId);

  if (stats.length > 0) {
    tripProgram.ratingsQuantity = stats[0].nRating;
    tripProgram.ratingsAverage = stats[0].avgRating;
  } else {
    tripProgram.ratingsQuantity = 0;
    tripProgram.ratingsAverage = 4.5;
  }

  await tripProgram.save({ validateModifiedOnly: true });
};

reviewSchema.statics.calcAvgRatingsCompany = async function (companyId) {
  const stats = await this.aggregate([
    {
      $match: { company: companyId },
    },
    {
      $group: {
        _id: '$company',
        nRating: { $sum: 1 },
        avgRating: { $avg: '$rating' },
      },
    },
  ]);

  const company = await userModel.findById(companyId);

  if (stats.length > 0) {
    company.ratingsQuantity = stats[0].nRating;
    company.ratingsAverage = stats[0].avgRating;
  } else {
    company.ratingsQuantity = 0;
    company.ratingsAverage = 4.5;
  }

  await company.save({ validateModifiedOnly: true });
};

reviewSchema.post('save', function () {
  if (this.tour) this.constructor.calcAvgRatingsTour(this.tour);
  else if (this.tripProgram)
    this.constructor.calcAvgRatingsTripProgram(this.tripProgram);
  else this.constructor.calcAvgRatingsCompany(this.company);
});

reviewSchema.pre(/^findOneAnd/, async function (next) {
  this.r = await this.findOne();
  next();
});

reviewSchema.post(/^findOneAnd/, async function () {
  const rev = await this.r;

  if (rev.tour) rev.constructor.calcAvgRatingsTour(rev.tour);
  else if (rev.tripProgram)
    rev.constructor.calcAvgRatingsTripProgram(rev.tripProgram);
  else rev.constructor.calcAvgRatingsCompany(rev.company);
});

const reviewModel = mongoose.model('reviewModel', reviewSchema);
module.exports = reviewModel;
