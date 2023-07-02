const mongoose = require('mongoose');
const AppError = require('../utils/appError');

// City Schema
const chatbotSchema = new mongoose.Schema({
  message: {
    type: String,
    required: [true, 'A Session must have a message'],
  },
  sessionId: {
    type: String,
    required: [true, 'A session must have a session id'],
  },
  hotelCityGeoId: String,
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now },
});

// Set the 'updated_at' field to the current date before saving the document
chatbotSchema.pre('save', function (next) {
  this.updated_at = new Date();
  next();
});

const Chatbot = mongoose.model('Chatbot', chatbotSchema);
module.exports = Chatbot;
