const fs = require('fs');
const User = require('../models/userModel');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const Factory = require('./handlerFactory');

const filterobj = (obj, ...allowedFields) => {
  const newobj = {};
  Object.keys(obj).forEach((el) => {
    if (allowedFields.includes(el)) newobj[el] = obj[el];
  });
  return newobj;
};
exports.GetAllUsers = Factory.getAll(User);
exports.deleteuser = Factory.deleteOne(User);
exports.Updateuser = Factory.updateOne(User);
exports.Getuser = Factory.getOne(User);
exports.createuser = Factory.createOne(User);

exports.deleteMe = (req, res, next) => {
  req.params.id = req.user._id;
  next();
};

exports.getMe = (req, res, next) => {
  req.params.id = req.user._id;
  next();
};

exports.UpdateMe = catchAsync(async (req, res, next) => {
  // 1) create error if user POSTs password data
  if (req.body.password || req.body.passwordConfirm) {
    return next(
      new AppError(
        'This route is not for update password. please use /updatePassword ',
        400
      )
    );
  }
  let image = undefined;
  if (req.file) {
    const file = req.file;
  console.log(file);
    console.log(cloudinary)
    cloudinary.config({
      cloud_name: process.env.cloud_name,
      api_key: process.env.api_key,
      api_secret: process.env.api_secret,
      secure: true,
    });
    const result = await cloudinary.uploader.upload(file.path, {
      folder: `gallery/profile`,
    });
    const { secure_url } = result;
     image = secure_url;

  }
  // 2) filter out unwanted fields names that are not allowed to be updated
  const {name,
  city,
  country,
  photo,
  contact,
  address,
  website,
  overview,} = req.body;
 

  // 3) Update user document
  const user = await User.findById(req.user._id);

  if (name) user.name = name;
  if (city) user.city = city;
  if (country) user.country = country;
  if (photo) user.photo = photo;
  if (contact) user.contact = contact;
  if (address) user.address = address;
  if (website) user.website = website;
  if (overview) user.overview = overview; 
  if (image) user.image = image;

  const updatedUser = await user.save({validateModifiedOnly:true});
  if(!updatedUser) return next(new AppError('error updating the user',400));
  
  res.status(200).json({
    status: 'success',
    data: {
      user: updatedUser,
    },
  });
});  
