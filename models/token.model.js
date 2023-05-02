const mongoose = require('mongoose');

const tokenSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: "User",
    },
    token: {
      type: String,
      required: true,
    },
    expiresAt: {
      type: Number,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);
  
const tokenModel = mongoose.model('tokenModel', tokenSchema);
module.exports = tokenModel;
