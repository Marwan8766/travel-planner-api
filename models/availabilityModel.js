const mongoose = require('mongoose');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');

const availabilitySchema = new mongoose.Schema({
  tour: { type: mongoose.Schema.Types.ObjectId, ref: 'Tour' },
  tripProgram: { type: mongoose.Schema.Types.ObjectId, ref: 'TripProgram' },
  date: { type: Date, required: true },
  availableSeats: { type: Number, required: true },
});

availabilitySchema.pre('save', function (next) {
  if (!this.tour && !this.tripProgram)
    return next(new AppError('Either a tour or trip program is required', 400));

  if (this.tour && this.tripProgram)
    return next(
      new AppError(
        'Each Availabilty must be for either a tour or a tripProgram',
        400
      )
    );

  next();
});

const Availability = mongoose.model('Availability', availabilitySchema);

module.exports = Availability;
