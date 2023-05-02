const mongoose = require('mongoose');
const Tour = require('./tourModel');
const AppError = require('../utils/appError');

const plannedTripSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  name: { type: String, required: true },
  budget: { type: Number, min: 0 },
  country: { type: mongoose.Schema.Types.ObjectId, ref: 'Country' },
  cities: [{ type: mongoose.Schema.Types.ObjectId, ref: 'City' }],
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  preferences: {
    likes_beaches: { type: Boolean, default: false },
    likes_museums: { type: Boolean, default: false },
    likes_nightlife: { type: Boolean, default: false },
  },
  crowdLevel: {
    type: String,
    enum: ['busy', 'moderate', 'quiet'],
    default: 'moderate',
  },
  days: [
    {
      date: { type: Date, required: true },
      timeline: [
        {
          attraction: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Attraction',
          },
          tour: { type: mongoose.Schema.Types.ObjectId, ref: 'Tour' },
          customActivity: { type: String },
          startTime: { type: Date, required: true },
          endTime: { type: Date, required: true },
        },
      ],
    },
  ],
});

plannedTripSchema.pre('save', async function (next) {
  if (!this.name) {
    const days = this.days.length;
    const name = `A ${days} day${days > 1 ? 's' : ''} in ${
      this.city || this.country
    }`;
    this.name = name;
  }

  // Calculate the total price of tours
  const tours = await Tour.find({
    _id: {
      $in: this.days.map((day) =>
        day.timeline
          .filter((activity) => activity.tour)
          .map((activity) => activity.tour)
      ),
    },
  });
  const totalTourPrice = tours.reduce((acc, tour) => acc + tour.price, 0);

  // Check if total tour price exceeds budget
  if (this.budget && totalTourPrice > this.budget)
    return next(new AppError('Total tour price exceeds budget', 400));

  // Check that each item in the timeline is either attraction, tour, or custom activity
  this.days.forEach((day) => {
    day.timeline.forEach((item) => {
      const { attraction, tour, customActivity } = item;
      if (
        (!attraction && !tour && !customActivity) ||
        (attraction && tour) ||
        (attraction && customActivity) ||
        (tour && customActivity)
      ) {
        return next(
          new AppError(
            'Each timeline item must be either an attraction, tour, or custom activity',
            400
          )
        );
      }
    });
  });

  next();
});

plannedTripSchema.pre('save', function (next) {
  const activities = {};
  let hasOverlap = false;

  this.days.forEach((day) => {
    day.timeline.forEach((item) => {
      const { attraction, tour, customActivity, startTime, endTime } = item;

      // Ensure that either attraction, tour, or custom activity is present
      if (!attraction && !tour && !customActivity) {
        return next(
          new AppError(
            'Each timeline item must be either an attraction, tour, or custom activity',
            400
          )
        );
      }

      // Check for overlap
      if (startTime < activities[day.date] && endTime > activities[day.date]) {
        hasOverlap = true;
      } else {
        activities[day.date] = endTime;
      }
    });
  });

  // Return error if there is an overlap
  if (hasOverlap) {
    return next(
      new AppError('Activities are overlapping in the timeline', 400)
    );
  }

  next();
});

plannedTripSchema.pre('save', function (next) {
  const trip = this;

  // Loop through all days in the trip
  trip.days.forEach((day) => {
    // Loop through all activities in the timeline for this day
    day.timeline.forEach((activity) => {
      // Only modify start and end times if the activity has a start time
      if (activity.startTime) {
        // Get the date for this day and convert it to ISO string format
        const dayDate = new Date(day.date).toISOString().substring(0, 10);

        // Modify the start time to be the same date as the day date
        activity.startTime = new Date(
          `${dayDate}T${activity.startTime.toISOString().substring(11, 19)}Z`
        );

        // Modify the end time to be the same date as the day date
        activity.endTime = new Date(
          `${dayDate}T${activity.endTime.toISOString().substring(11, 19)}Z`
        );
      }
    });
  });

  next();
});

const PlannedTrip = mongoose.model('PlannedTrip', plannedTripSchema);

module.exports = PlannedTrip;
