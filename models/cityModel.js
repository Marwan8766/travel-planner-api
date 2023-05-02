const mongoose = require('mongoose');
const AppError = require('../utils/appError');

// City Schema
const citySchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
  },
});

const City = mongoose.model('City', citySchema);
module.exports = City;
