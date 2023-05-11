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

  let image = undefined;
  if (req.file) {
    const file = req.file;
    cloudinary.config({
      cloud_name: process.env.cloud_name,
      api_key: process.env.api_key,
      api_secret: process.env.api_secret,
      secure: true,
    });
    const result = await cloudinary.uploader.upload(file.path, {
      folder: gallery / profile,
    });
    const { secure_url } = result;
    image = secure_url;
  }

  const tour = await tourModel.findOne({ _id: tourId });
  if (!tour) {
    return next(new AppError('Tour not found', 404));
  }

  tour.description = description ? description : tour.description;
  tour.image = image ? image : tour.image;
  tour.rating = rating ? rating : tour.rating;

  const review = await tour.save({ validateModifiedOnly: true });
  if (!review) {
    return next(new AppError('Could not save review', 400));
  }

  // Create a new review document in the reviewModel collection
  const newReview = await reviewModel.create({
    tour: tourId,
    image,
    description,
    rating,
    user: req.user._id,
  });

  if (!newReview) {
    return next(new AppError('Could not create review', 400));
  }

  res.status(200).json({
    status: 'success',
    data: {
      review: newReview,
    },
  });
});

exports.createTripProgramReview = catchAsync(async (req, res, next) => {
  const tripProgramId = req.params.id;
  const { description, rating } = req.body;

  let image = undefined;
  if (req.file) {
    const file = req.file;
    cloudinary.config({
      cloud_name: process.env.cloud_name,
      api_key: process.env.api_key,
      api_secret: process.env.api_secret,
      secure: true,
    });
    const result = await cloudinary.uploader.upload(file.path, {
      folder: gallery / profile,
    });
    const { secure_url } = result;
    image = secure_url;
  }

  const tripProgram = await tripProgramModel.findOne({ _id: tripProgramId });
  if (!tripProgram) {
    return next(new AppError('tripProgram not found', 404));
  }

  tripProgram.description = description ? description : tripProgram.description;
  tripProgram.image = image ? image : tripProgram.image;
  tripProgram.rating = rating ? rating : tripProgram.rating;

  const review = await tripProgram.save({ validateModifiedOnly: true });
  if (!review) {
    return next(new AppError('Could not save review', 400));
  }

  // Create a new review document in the reviewModel collection
  const newReview = await reviewModel.create({
    tripProgram: tripProgramId,
    image,
    description,
    rating,
    user: req.user._id,
  });

  if (!newReview) {
    return next(new AppError('Could not create review', 400));
  }

  res.status(200).json({
    status: 'success',
    data: {
      review: newReview,
    },
  });
});

exports.createCompanyReview = catchAsync(async (req, res, next) => {
  const companyId = req.params.id;
  const { description, rating } = req.body;

  let image = undefined;
  if (req.file) {
    const file = req.file;
    cloudinary.config({
      cloud_name: process.env.cloud_name,
      api_key: process.env.api_key,
      api_secret: process.env.api_secret,
      secure: true,
    });
    const result = await cloudinary.uploader.upload(file.path, {
      folder: gallery / profile,
    });
    const { secure_url } = result;
    image = secure_url;
  }
  const company = await User.findOne({
    _id: companyId,
    role: 'company',
  });
  if (!company) {
    return next(new AppError('company not found', 404));
  }

  company.description = description ? description : company.description;
  company.image = image ? image : company.image;
  company.rating = rating ? rating : company.rating;

  const review = await company.save({ validateModifiedOnly: true });
  if (!review) {
    return next(new AppError('Could not save review', 400));
  }

  // Create a new review document in the reviewModel collection
  const newReview = await reviewModel.create({
    company: companyId,
    image,
    description,
    rating,
    user: req.user._id,
  });

  if (!newReview) {
    return next(new AppError('Could not create review', 400));
  }

  res.status(200).json({
    status: 'success',
    data: {
      review: newReview,
    },
  });
});

exports.deleteReview = catchAsync(async (req, res, next) => {
  // find the review
  const review = await reviewModel.findOne({ _id: req.params.id });
  // if no review was found throw  an rror
  if (!review) return next(new AppError("This review could't be found", 404));
  if (req.user.role === 'admin') {
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
    const deletedReview = await reviewModel.findOneAndDelete({
      _id: req.params.id,
    });

    // if no review was found throw error
    if (!deletedReview)
      return next(new AppError("This review wasn't found", 404));
  } else {
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
    const deletedReview = await reviewModel.findOneAndDelete({
      _id: req.params.id,
      user: req.user._id,
    });

    // if no review was found throw error
    if (!deletedReview)
      return next(new AppError("This review wasn't found", 404));
  }
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

exports.updateReview = catchAsync(async (req, res, next) => {
  const { rating, description } = req.body;
  let image = undefined;

  if (req.file) {
    const file = req.file;
    cloudinary.config({
      cloud_name: process.env.cloud_name,
      api_key: process.env.api_key,
      api_secret: process.env.api_secret,
      secure: true,
    });
    const result = await cloudinary.uploader.upload(file.path, {
      folder: gallery / review,
    });
    const { secure_url } = result;
    image = secure_url;
  }

  const review = await reviewModel.findOne({
    _id: req.params.id,
    user: req.user._id,
  });
  if (!review) return next(new AppError('No review found for that ID', 404));
  // Check if the authenticated user is an admin
  if (req.user.role === 'admin') {
    // Admin is authorized to update the review
    review.rating = rating ? rating : review.rating;
    review.description = description ? description : review.description;
    review.image = image ? image : review.image;
  } else {
    // User is not an admin, so they can only update their own reviews
    if (review.user.toString() !== req.user._id.toString()) {
      return next(
        new AppError('You are not authorized to update this review', 403)
      );
    }
    // User is authorized to update their own review
    review.rating = rating ? rating : review.rating;
    review.description = description ? description : review.description;
    review.image = image ? image : review.image;
  }

  const updatedReview = await review.save({ validateModifiedOnly: true });
  if (!updatedReview)
    return next(new AppError('Error updating the review', 400));

  res.status(200).json({
    status: 'success',
    data: {
      data: updatedReview,
    },
  });
});

exports.getAllTourReviews = catchAsync(async (req, res, next) => {
  // find all tour reviews
  const reviews = await reviewModel.find({ tour: req.params.id });
  // if there is no reviews throw an error
  if (reviews.length === 0)
    return next(new AppError('There is no reviews found', 404));
  // send res ison with success and reviews
  res.status(200).json({
    status: 'success',
    data: reviews,
  });
});

exports.getAllTripProgramReviews = catchAsync(async (req, res, next) => {
  // find all tour reviews
  const reviews = await reviewModel.find({ tripProgram: req.params.id });
  // if there is no reviews throw an error
  if (reviews.length === 0)
    return next(new AppError('There is no reviews found', 404));
  // send res ison with success and reviews
  res.status(200).json({
    status: 'success',
    data: reviews,
  });
});

exports.getAllCompanyReviews = catchAsync(async (req, res, next) => {
  // find all tour reviews
  const reviews = await reviewModel.find({ company: req.params.id });
  // if there is no reviews throw an error
  if (reviews.length === 0)
    return next(new AppError('There is no reviews found', 404));
  // send res ison with success and reviews
  res.status(200).json({
    status: 'success',
    data: reviews,
  });
});
