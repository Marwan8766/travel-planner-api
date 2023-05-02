
const express = require('express');
const { myMulter, fileValidation } = require('../utils/multer');
const reviewController = require('../controllers/reviewController');
const authController = require('../controllers/authController');
///////////////////////////////////////////////////////

const router = express.Router();

router.get('/', reviewController.getAllReviews);

// all routes after this middleware is for authienticated users only
router.use(authController.protect);


router.post(
  '/tour/:id',
  myMulter(fileValidation.image).single('image'),
  reviewController.createTourReview
);
router.post(
  '/tripProgram/:id',
  myMulter(fileValidation.image).single('image'),
  reviewController.createTripProgramReview
);
router.post(
  '/company/:id',
  myMulter(fileValidation.image).single('image'),
  reviewController.createCompanyReview
);

router.delete('/:id', reviewController.deleteReview);

// update review only the user who created the review is able to update it
//

module.exports = router;
// Only admin can use the following routes after this middleware
router.use(authController.restrictTo('admin'));


