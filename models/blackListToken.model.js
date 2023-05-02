const mongoose = require('mongoose');

const blackListTokenSchema = new mongoose.Schema(
  {
    token: {
      type: String,
      required: [true, "A blackListToken must have a token"],
    },
    expiresAt: {
      type: Number,
      required: [true, "A blackListToken must have a expiresAt time"],
    },
  },
  {
    timestamps: true,
  }
);
  
const blacklistToken = mongoose.model('blacklistToken', blackListTokenSchema);
module.exports = blacklistToken;
