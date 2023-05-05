const mongoose = require('mongoose');
const validator = require('validator');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const AppError = require('../utils/appError');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Please write your name'],
  },
  image: {
    type: String,
  },
  email: {
    type: String,
    required: [true, 'Please provide your email'],
    unique: true,
    lowercase: true, // convert to lowercase but not a validator
    validate: [validator.isEmail, 'Please provide a valid email'],
  },
  password: {
    type: String,
    required: [true, 'Please provide a password'],
    validate: [
      validator.isStrongPassword,
      'Please write a password with at least 1 lowercase , 1 uppercase , 1 symbol and min length of 8 characters',
    ],
    select: false,
  },
  passwordConfirm: {
    type: String,
    required: [true, 'Please confirm your password'],
    validate: {
      // only works for create and save
      // if update is used it won't work
      validator: function (el) {
        return el === this.password;
      },
      message: "Passwords aren't the same!",
    },
  },
  role: {
    type: String,
    enum: ['user', 'admin', 'company'],
    default: 'user',
  },
  gender: {
    type: String,
    enum: ['male', 'female'],
    // default: 'male',
  },
  contact: {
    type: Number,
  },
  address: {
    type: String,
  },
  website: {
    type: String,
  },

  overview: {
    type: String,
    trim: true,
    select: true,
  },
  stripeAccountId: String,
  country: String,
  city: String,

  ratingsAverage: {
    type: Number,
    default: 4.5,
    min: [1, 'rating avg must be above 1.0'],
    max: [5, 'rating avg must be below 5.0'],
    set: (val) => Math.round(val * 10) / 10, // 4.666 , 64.6 , 47 , 4.7
  },
  ratingsQuantity: {
    type: Number,
    default: 0,
  },

  passwordChangedAt: Date,
  passwordResetToken: String,
  passwordResetExpires: Date,
  emailConfirmToken: String,
  emailConfirmTokenExpires: Number,
  emailConfirmed: {
    type: Boolean,
    default: false,
    select: false,
  },
  active: {
    type: Boolean,
    default: true,
    select: false,
  },
});

userSchema.pre('save', async function (next) {
  // this refers to the current document(the current user)

  // only run this function if the password was modified
  if (!this.isModified('password')) return next();

  // hash the password with cost of 12
  this.password = await bcrypt.hash(this.password, 12);

  // delete the passwordConfirm as we just needed it for validation but
  // not to persist it to the database
  this.passwordConfirm = undefined;

  // calling next to not to stop our mongoose middleware here
  next();
});

userSchema.pre('save', function (next) {
  if (
    this.role !== 'company' &&
    (this.website || this.overview || this.address || this.stripeAccountId)
  )
    return next(
      new AppError(
        'only companies are allowed to add website , address or overview',
        400
      )
    );
  next();
});

userSchema.pre('save', async function (next) {
  const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

  // if the user isnot a company return
  if (this.role !== 'company') return next();

  // check that the company must have contact and address
  if (!this.address || !this.contact || !this.city || !this.country)
    return next(
      new AppError(
        'A company must have address, contact, city and country',
        400
      )
    );

  // if company already has an stripeAccountId return
  if (this.stripeAccountId) return next();

  try {
    console.log('stripe secrett: ', process.env.STRIPE_SECRET_KEY);
    // create a Stripe account for the company
    const account = await stripe.accounts.create({
      type: 'custom',
      email: this.email,
      business_type: 'company',
      business_profile: {
        name: this.name,
        url: this.website,
      },
      company: {
        name: this.name,
        address: {
          line1: this.address,
        },
      },
      capabilities: {
        card_payments: {
          requested: true,
        },
        transfers: {
          requested: true,
        },
      },
    });

    // save the Stripe account ID to the user document
    this.stripeAccountId = account.id;

    next();
  } catch (error) {
    console.error('error: ', error);
    return next(new AppError('Error creating Stripe account', 500));
  }
});

userSchema.pre('save', function (next) {
  if (!this.isModified('password') || this.isNew) return next();
  // we subtract 1 sec bec the saving into DB can take more time than creating the token
  // so this won't be accurate but it ensures that the token is generated
  // after the passwordChangedAt
  this.passwordChangedAt = Date.now() - 1000;
  next();
});

userSchema.pre(/^find/, function (next) {
  this.find({ active: { $ne: false } });
  next();
});

// create instance on userSChema
// this method will be available on all documents of user
userSchema.methods.correctPassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

userSchema.methods.passwordHasChanged = function (jwtTimestamp) {
  if (this.passwordChangedAt) {
    const changedAt = parseInt(this.passwordChangedAt.getTime() / 1000, 10);
    // the greater timestamp the newest
    return jwtTimestamp < changedAt;
  }

  // user does not have passwordChangetAt
  return false;
};

userSchema.methods.createPasswordResetToken = function () {
  // generate random string
  const resetToken = crypto.randomBytes(32).toString('hex');
  // hash the str and save it into the DB and update the str with the hashed one
  this.passwordResetToken = crypto
    .createHash('sha256')
    .update(resetToken)
    .digest('hex');
  // set expire date after 10 minutes
  this.passwordResetExpires = Date.now() + 10 * 60 * 1000;
  // return the unhashed str to send it via email
  return resetToken;
};

userSchema.methods.createEmailConfirmtToken = function () {
  // generate random string
  const resetToken = crypto.randomBytes(32).toString('hex');
  // hash the str and save it into the DB and update the str with the hashed one
  this.emailConfirmToken = crypto
    .createHash('sha256')
    .update(resetToken)
    .digest('hex');
  // set expire date after 10 minutes
  this.emailConfirmTokenExpires = Date.now() + 10 * 60 * 1000;
  // return the unhashed str to send it via email
  return resetToken;
};

const User = mongoose.model('User', userSchema);
module.exports = User;
