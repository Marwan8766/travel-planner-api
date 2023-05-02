const reviewModel = require('../models/review.model');
const tripProgramModel = require('../models/tripProgramsmodel');
const tourModel = require('../models/tourModel');
// const cloudinary = require('../utils/cloudinary');
const cloudinary = require('cloudinary').v2;
const fs = require('fs');
const User = require('../models/userModel');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const Factory = require('./handlerFactory');
const { error } = require('console');

exports.createTourReview = catchAsync(async (req, res, next) => {
  const tourId = req.params.id;
  const { description, rating } = req.body;
  const tour = await tourModel.findOne({ _id: tourId });
  if (!tour) {
    return next(new AppError('Tour not found', 404));
  }
  if (!req.file) {
    return next(new AppError('Image is required', 400));
  }
  const file = req.file;
  console.log(file);

  try {
    console.log(cloudinary)
    cloudinary.config({
      cloud_name: process.env.cloud_name,
      api_key: process.env.api_key,
      api_secret: process.env.api_secret,
      secure: true,
    });
    const result = await cloudinary.uploader.upload(file.path, {
      folder: `gallery/review`,
    });
    const { secure_url } = result;
    const image = secure_url;

    const review = await reviewModel.create({
      tour: tourId,
      image,
      description,
      rating,
      user:req.user._id
    });
    console.log(review);
    if (!review) {
      return next(new AppError('Could not create review', 400));
    }

    res.status(200).json({
      status: 'success',
      data: {
        review,
      },
    });
  } catch (err) {
    return next(new AppError(`Could not upload this review: ${err.message}`, 400));
  }
});

exports.createTripProgramReview = catchAsync(async (req, res, next) => {
  const tripProgramId = req.params.id;
  const { description, rating } = req.body;
  console.log(description);
  console.log(rating);
  console.log(tripProgramId);
  const tripProgram = await tripProgramModel.findOne({ _id: tripProgramId });
  if (!tripProgram) {
    return next(new AppError('tripProgram not found', 404));
  }
  if (!req.file) {
    return next(new AppError('Image is required', 400));
  }
  const file = req.file;
  console.log(file);

  try {
    console.log(cloudinary)
    cloudinary.config({
      cloud_name: process.env.cloud_name,
      api_key: process.env.api_key,
      api_secret: process.env.api_secret,
      secure: true,
    });
    const result = await cloudinary.uploader.upload(file.path, {
      folder: `gallery/review`,
    });
    const { secure_url } = result;
    const image = secure_url;

    const review = await reviewModel.create({
      tripProgram: tripProgramId,
      image,
      description,
      rating,
      user:req.user._id
    });
    console.log(review);
    if (!review) {
      return next(new AppError('Could not create review', 400));
    }

    res.status(200).json({
      status: 'success',
      data: {
        review,
      },
    });
  } catch (err) {
    return next(new AppError(`Could not upload this review: ${err.message}`, 400));
  }
});

exports.createCompanyReview = catchAsync(async (req, res, next) => {
  const userId = req.params.id;
  const { description, rating } = req.body;
  console.log(description);
  console.log(rating);
  console.log(userId);
  const company = await User.findOne({ _id: userId, role: 'company' });
  if (!company) {
    return next(new AppError('company not found', 404));
  }
  if (!req.file) {
    return next(new AppError('Image is required', 400));
  }
  const file = req.file;
  console.log(file);

  try {
    console.log(cloudinary)
    cloudinary.config({
      cloud_name: process.env.cloud_name,
      api_key: process.env.api_key,
      api_secret: process.env.api_secret,
      secure: true,
    });
    const result = await cloudinary.uploader.upload(file.path, {
      folder: `gallery/review`,
    });
    const { secure_url } = result;
    const image = secure_url;

    const review = await reviewModel.create({
      company: userId,
      image,
      description,
      rating,
      user:req.user._id
    });
    console.log(review);
    if (!review) {
      return next(new AppError('Could not create review', 400));
    }

    res.status(200).json({
      status: 'success',
      data: {
        review,
      },
    });
  } catch (err) {
    return next(new AppError(`Could not upload this review: ${err.message}`, 400));
  }
});

exports.deleteReview = catchAsync(async (req, res, next) => {
  // find the review
  const review = await reviewModel.findOne({_id:req.params.id, user: req.user._id});
  // if no review was found throw  an rror
  if (!review) return next(new AppError("This review could't be found", 404));

  // find the reviewUrl from the review
  const reviewUrl = review.image;

  // find the publicId from the image url
  const parts = reviewUrl.split('/');
  const publicId = parts[parts.length - 2];

  // find that review and delete it from cloudinary
  cloudinary.uploader
    .destroy(publicId, { resouce_type: 'image' })
    .catch((err) => next(new AppError("This review wasn't found", 404)));

  // find the review and delete it from DB
  const deletedReview = await reviewModel.findOneAndDelete({_id:req.params.id, user: req.user._id});

  // if no review was found throw error
  if (!deletedReview)
    return next(new AppError("This review wasn't found", 404));

  // send res json with success message and deleted review
  res.status(204).json({
    status: 'success',
    data: null,
  });
});

exports.getAllReviews = catchAsync(async (req, res, next) => {
  // find all reviews
  const reviews = await reviewModel.find();
  // if there is no reviews throw an error
  if (reviews.length === 0)
    return next(new AppError('There is no reviews found', 404));
  // send res json with success and reviews
  res.status(200).json({
    status: 'success',
    data: reviews,
  });
});
