const sendMail = require('../utils/email');
const jwt = require('jsonwebtoken');
const { promisify } = require('util');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const cloudinary = require('cloudinary').v2;
const AppError = require('../utils/appError');
const catchAsync = require('../utils/catchAsync');
const sendEmail = require('../utils/email');
const User = require('../models/userModel');
const Token = require('../models/token.model');
const blacklistToken = require('../models/blackListToken.model');

const signToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN,
  });

exports.signup = catchAsync(async (req, res, next) => {
  console.log('SIGNUP FROM USERS ENDPOINT...');
  // check if user already exists
  const userExist = await User.findOne({ email: req.body.email }).select(
    '+emailConfirmed'
  );
  let image = '';
  if (req.file) {
    const file = req.file;
    console.log(file);
    console.log(cloudinary);
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

  console.log(userExist);
  if (userExist) {
    // check if email is confirmed
    if (userExist.emailConfirmed === true)
      return next(new AppError('This email already exists', 400));
    // check if emailConfirmationToken is valid
    if (userExist.emailConfirmTokenExpires > Date.now())
      return next(
        new AppError(
          'Open the link that was sent to your Email to verify your Email',
          400
        )
      );
    // if email isnot confirmed and token is expired delete that user
    await User.findOneAndDelete({ email: req.body.email });
  }
  // save user data
  const newUser = await User.create({
    name: req.body.name,
    email: req.body.email,
    password: req.body.password,
    passwordConfirm: req.body.passwordConfirm,
    contact: req.body.contact,
    address: req.body.address,
    website: req.body.website,
    image,
    overview: req.body.overview,
    country: req.body.country,
    city: req.body.city,
    role: req.body.role === 'admin' ? 'user' : req.body.role,
  });
  // create token to be sent by email
  const token = newUser.createEmailConfirmtToken();
  const updatedNewUser = await newUser.save({ validateModifiedOnly: true });

  if (!updatedNewUser)
    return next(new AppError('Error signing you up please try again', 500));

  // SEND the token to users's email
  const confirmEmailURL = `${req.protocol}://${req.get(
    'host'
  )}/api/v1/users/confirmEmail/${token}`;

  const html = `<h1>open this url to confirm your email</h1> <a href="${confirmEmailURL}"> Click Here </a>`;

  const optionsObj = {
    email: newUser.email,
    subject: 'Your Email confirm token, valid for 10 minutes',
    html,
  };

  let accountLink;
  const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

  if (updatedNewUser.stripeAccountId && updatedNewUser.role === 'company') {
    // Send an email to the customer to complete their account setup
    accountLink = await stripe.accountLinks.create({
      account: updatedNewUser.stripeAccountId,
      type: 'account_onboarding',
      refresh_url: 'https://example.com/reauth',
      return_url: 'https://example.com/return',
    });
  }
  console.log('acc link: ', accountLink);
  let optionsObj2;

  if (updatedNewUser.stripeAccountId && updatedNewUser.role === 'company')
    optionsObj2 = {
      email: newUser.email,
      subject:
        'Your stripe account link, please open and continue activating your account to be able to sell your services and receive money',
      html: `<h1>open this url and activate your stripe account</h1><a href="${accountLink.url}"> Click Here </a>
    <a href="${accountLink.url}"></a>
    `,
    };

  try {
    let emailForUser = await sendMail(optionsObj);

    if (updatedNewUser.stripeAccountId && updatedNewUser.role === 'company')
      emailForUser = await sendMail(optionsObj2);

    console.log('email for user', emailForUser);

    res.status(200).json({
      status: 'success',
      message: 'Your email confirmation token has been sent to the email',
    });
  } catch (err) {
    // newUser.emailConfirmToken = undefined;
    // newUser.emailConfirmTokenExpires = undefined;
    // await newUser.save({ validateModifiedOnly: true });
    console.log('error deleting user now... as the email isnot sent');
    const deletedUSer = await User.findByIdAndDelete(newUser._id);
    if (!deletedUSer)
      console.log('Error couldnot delete user for error in sending email');
    return next(new AppError('There was an error sending the email', 500));
  }
});

exports.confirmEmail = catchAsync(async (req, res, next) => {
  // encrypt token sent by email
  console.log('yy');

  let token = crypto
    .createHash('sha256')
    .update(req.params.token)
    .digest('hex');
  // find the user that has this token
  const user = await User.findOne({
    emailConfirmToken: token,
    emailConfirmTokenExpires: { $gt: Date.now() },
  }).select('+emailConfirmed');
  if (!user)
    return next(new AppError('Please signup again your token has expired'));
  // confirm user's email
  user.emailConfirmed = true;
  user.emailConfirmToken = undefined;
  user.emailConfirmTokenExpires = undefined;
  await user.save({ validateModifiedOnly: true });
  // console.log("yy")
  token = signToken(user._id);
  res.status(200).json({
    state: 'success',
    message: 'Your email has been successfully confirmed',
    token,
  });
});

exports.login = catchAsync(async (req, res, next) => {
  const { email, password } = req.body;

  // check if email and password exists
  if (!email || !password)
    return next(
      new AppError('Please provide us with your email and password', 400)
    );
  // check if user exist and password is correct
  // we need the password to check if it is the same but findOne won't find it because
  // we set select: false so we use select('+password)
  const user = await User.findOne({ email })
    .select('+password')
    .select('+emailConfirmed');

  if (!user || !(await user.correctPassword(password)))
    return next(new AppError('Incorrect email or password', 401));

  if (!user.emailConfirmed)
    return next(new AppError('Please confirm your email first'));

  // if everything is ok send token to client
  const token = signToken(user._id);
  const decoded = jwt.verify(token, process.env.JWT_SECRET);
  const expiresAt = decoded.exp;
  const tokenDocument = await Token.create({
    userId: user._id,
    token,
    expiresAt,
  });
  if (!tokenDocument)
    return next(
      new AppError('Error while logging in please try again later', 400)
    );
  res.status(200).json({
    status: 'success',
    token,
  });
});

exports.logout = catchAsync(async (req, res, next) => {
  const user = req.user;

  // find all tokens associated with that user
  const tokens = await Token.find({ userId: user._id });
  // check if the tokens array isnot empty
  if (tokens.length > 0) {
    // loop over the tokens
    for (let i = 0; i < tokens.length; i++) {
      // add each token to expire list
      const blackListToken = await blacklistToken.create({
        token: tokens[i].token,
        expiresAt: Number(tokens[i].expiresAt),
      });
      // check that each token is added else return with error
      if (!blackListToken)
        return next(new AppError('Error while logging out', 400));
    }
    // delete all tokrns associated with that user from tokens collection
    const deletedTokens = await Token.deleteMany({ userId: user._id });
    // if there was an error return next
    if (!deletedTokens)
      return next(new AppError('Error while logging out', 400));
  }
});

exports.forgotPassword = catchAsync(async (req, res, next) => {
  // GET user based on POSTed email
  const user = await User.findOne({ email: req.body.email });
  if (!user) return next(new AppError('There is no user with this email'), 404);
  // add all tokens associated with that user to black list

  // find all tokens associated with that user
  const tokens = await Token.find({ userId: user._id });
  // check if the tokens array isnot empty
  if (tokens.length > 0) {
    // loop over the tokens
    for (let i = 0; i < tokens.length; i++) {
      // add each token to expire list
      const blackListToken = await blacklistToken.create({
        token: tokens[i].token,
        expiresAt: Number(tokens[i].expiresAt),
      });
      // check that each token is added else return with error
      if (!blackListToken)
        return next(new AppError('Error while Changing password', 400));
    }
    // delete all tokrns associated with that user from tokens collection
    const deletedTokens = await Token.deleteMany({ userId: user._id });
    // if there was an error return next
    if (!deletedTokens)
      return next(new AppError('Error while changing password', 400));
  }
  // GENERATE the random reset token
  const resetToken = user.createPasswordResetToken();
  // to save the new added fields to the DB
  await user.save({ validateModifiedOnly: true });

  // SEND the token to users's email
  const resetURL = `${req.protocol}://${req.get(
    'host'
  )}/api/v1/users/resetPassword/${resetToken}`;

  const html = `<h1>If you didn't forget your password please ignore this email</h1><h1>open this url to reset your password</h1> <a href="${resetURL}"> Click Here </a>`;

  const optionsObj = {
    email: user.email,
    subject: 'Your password reset token, valid for 10 minutes',
    html,
  };
  try {
    await sendEmail(optionsObj);

    res.status(200).json({
      status: 'success',
      message: 'Your reset token has been sent to the email',
    });
  } catch (err) {
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save({ validateModifiedOnly: true });
    return next(new AppError('There was an error sending the email', 500));
  }
});

exports.resetPassword = catchAsync(async (req, res, next) => {
  // GET user based on the token
  const hashedToken = crypto
    .createHash('sha256')
    .update(req.params.token)
    .digest('hex');

  const user = await User.findOne({
    passwordResetToken: hashedToken,
    passwordResetExpires: { $gt: Date.now() },
  });
  // IF token hasn't expired and there is user , set new password
  if (!user) return next(new AppError('Token is invalid or has expired'), 400);

  user.password = req.body.password;
  user.passwordConfirm = req.body.passwordConfirm;
  user.passwordResetToken = undefined;
  user.passwordResetExpires = undefined;
  // add all tokens associated with that user to black list

  // find all tokens associated with that user
  const tokens = await Token.find({ userId: user._id });
  // check if the tokens array isnot empty
  if (tokens.length > 0) {
    // loop over the tokens
    for (let i = 0; i < tokens.length; i++) {
      // add each token to expire list
      const blackListToken = await blacklistToken.create({
        token: tokens[i].token,
        expiresAt: Number(tokens[i].expiresAt),
      });
      // check that each token is added else return with error
      if (!blackListToken)
        return next(new AppError('Error while Changing password', 400));
    }
    // delete all tokrns associated with that user from tokens collection
    const deletedTokens = await Token.deleteMany({ userId: user._id });
    // if there was an error return next
    if (!deletedTokens)
      return next(new AppError('Error while changing password', 400));
  }
  // UPDATE passwordChangedAt
  user.save({ validateModifiedOnly: true });
  // LOGIN the user, send jwt
  const token = signToken(user._id);

  res.status(200).json({
    status: 'success',
    token,
  });
});

exports.updatePassword = catchAsync(async (req, res, next) => {
  // 1) Get user from collection
  const user = await User.findById(req.user._id).select('+password');

  // 2) check if POSTed current password is correct

  if (!(await user.correctPassword(req.body.passwordCurrent, user.password))) {
    return next(new AppError('your current password is wrong', 401));
  }
  // add all tokens associated with that user to black list

  // find all tokens associated with that user
  const tokens = await Token.find({ userId: user._id });
  // check if the tokens array isnot empty
  if (tokens.length > 0) {
    // loop over the tokens
    for (let i = 0; i < tokens.length; i++) {
      // add each token to expire list
      const blackListToken = await blacklistToken.create({
        token: tokens[i].token,
        expiresAt: Number(tokens[i].expiresAt),
      });
      // check that each token is added else return with error
      if (!blackListToken)
        return next(new AppError('Error while Changing password', 400));
    }
    // delete all tokrns associated with that user from tokens collection
    const deletedTokens = await Token.deleteMany({ userId: user._id });
    // if there was an error return next
    if (!deletedTokens)
      return next(new AppError('Error while changing password', 400));
  }
  // 3) if so, update password
  user.password = req.body.password;
  user.passwordConfirm = req.body.passwordConfirm;
  await user.save({ validateModifiedOnly: true });

  // 4) log user in, send jwt
  // createSendToken(user, 200, res);
  const token = signToken(user._id);
  res.status(200).json({
    status: 'success',
    token,
  });
});

exports.deleteAccount = catchAsync(async (req, res, next) => {
  if (!req.body.password) next(new AppError('Please enter your password', 401));
  const user = await User.findOne({ email: req.user.email }).select(
    '+password'
  );
  if (!(await user.correctPassword(req.body.password)))
    return next(new AppError('Incorrect password', 401));

  await User.findByIdAndUpdate(user._id, {
    $set: { active: false },
    emailConfirmed: false,
  });

  res.status(204).json({
    status: 'success',
    data: null,
  });
});

exports.reActivateAccount = catchAsync(async (req, res, next) => {
  // update the account active to be true to be able to find the user
  await User.updateOne({ email: req.body.email }, { $set: { active: true } });
  // find the user
  const user = await User.findOne({ email: req.body.email })
    .select('+password')
    .select('+emailConfirmed');
  // check if password is correct if not make the acc inactive again
  if (!(await user.correctPassword(req.body.password))) {
    await User.updateOne(
      { email: req.body.email },
      { $set: { active: false } },
      { emailConfirmed: true }
    );
    return next(new AppError('Incorrect email or password'), 401);
  }
  // login the user
  const token = signToken(user._id);

  res.status(200).json({
    status: 'success',
    message: 'Your Account reactivated successfully',
    data: {
      token,
    },
  });
});

exports.protect = catchAsync(async (req, res, next) => {
  // get token and check if it exists
  let token;
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  )
    token = req.headers.authorization.split(' ')[1];
  // else if (req.cookies.jwt) token = req.cookies.jwt;

  if (!token)
    return next(new AppError("You aren't logged in, please login first", 401));
  // verification token
  const decoded = await promisify(jwt.verify)(token, process.env.JWT_SECRET);

  // check if the user still exists
  const currentUser = await User.findById(decoded.id).select('+emailConfirmed');
  if (!currentUser)
    return next(new AppError('This user does no longer exist'), 401);

  console.log(`user emailConfirmed: ${currentUser.emailConfirmed}`);
  console.log(`user role: ${currentUser.role}`);
  // check if user confirmed his email
  if (!currentUser.emailConfirmed)
    return next(new AppError('You must confirm your email first', 403));

  // check if the user has chamged his password after the token was issued
  if (
    currentUser.passwordHasChanged(decoded.iat, currentUser.passwordChangedAt)
  )
    return next(
      new AppError('Your password has changed, please login again', 401)
    );

  // check if the token is in the black list tokens
  const tokenBlackListed = await blacklistToken.findOne({ token });
  if (tokenBlackListed)
    return next(
      new AppError('Your session has expired, please login again', 401)
    );

  req.user = currentUser;
  // Grant access to the protected route
  next();
});

exports.restrictTo =
  (...roles) =>
  (req, res, next) => {
    if (!roles.includes(req.user.role))
      return next(
        new AppError("You don't have permission to perform this action", 403)
      );
    next();
  };
