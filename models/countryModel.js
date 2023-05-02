const mongoose = require('mongoose');

const countrySchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
  },
  continent: {
    type: String,
    required: true,
  },
  language: {
    type: String,
    required: true,
  },
  currency: {
    type: String,
    required: true,
  },
  cities: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'City',
    },
  ],
});

const Country = mongoose.model('Country', countrySchema);

module.exports = Country;
