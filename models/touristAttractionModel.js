const mongoose = require('mongoose');
const City = require('./cityModel');

const touristAttractionSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  link: { type: String, required: true },
  rating: { type: String },
  type: { type: String },
  description: { type: String },
  image: { type: String },
  open_close_times: { type: mongoose.Schema.Types.Mixed },
  location: {
    type: {
      type: String,
      default: 'Point',
      enum: ['Point'],
    },
    coordinates: [Number],
  },
  city: { type: mongoose.Schema.Types.ObjectId, ref: 'City', required: true }, // Reference to City document
});

touristAttractionSchema.index({ location: '2dsphere' });

touristAttractionSchema.pre(/^find/, function (next) {
  this.populate({
    path: 'city',
    select: '-__v',
    populate: {
      path: 'country',
      select: '-__v',
    },
  });

  next();
});

const TouristAttraction = mongoose.model(
  'TouristAttraction',
  touristAttractionSchema
);

module.exports = TouristAttraction;
