const express = require('express');
const { myMulter, fileValidation } = require('../utils/multer');
const reviewController = require('../controllers/reviewController');
const authController = require('../controllers/authController');
///////////////////////////////////////////////////////

const router = express.Router();

router.get('/', reviewController.getAllReviews);
router.get('/getAllTourReviews/:id', reviewController.getAllTourReviews);
router.get('/getAllTripProgramReviews/:id', reviewController.getAllTripProgramReviews);
router.get('/getAllCompanyReviews/:id', reviewController.getAllCompanyReviews);

// all routes after this middleware is for authienticated users only
router.use(authController.protect);


router.post(
  '/tour/:id',authController.protect, authController.restrictTo('user'),
  myMulter(fileValidation.image).single('image'),
  reviewController.createTourReview
);
router.post(
  '/tripProgram/:id',authController.protect, authController.restrictTo('user'),
  myMulter(fileValidation.image).single('image'),
  reviewController.createTripProgramReview
);
router.post(
  '/company/:id',authController.protect, authController.restrictTo('user'),
  myMulter(fileValidation.image).single('image'),
  reviewController.createCompanyReview
);

router.delete('/:id',authController.protect, authController.restrictTo('user', 'admin'),reviewController.deleteReview)



// update review only the user who created the review is able to update it
// router.patch('/:id', authController.protect, authController.restrictTo('user'),reviewController.updateReview)

router.patch(
  '/:id',
  authController.protect,
  authController.restrictTo('admin', 'user'),
  reviewController.updateReview
);

module.exports = router;