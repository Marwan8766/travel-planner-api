const express = require('express');
const tourController = require('../controllers/tourController');
const authController = require('../controllers/authController');

const { myMulter, fileValidation } = require('../utils/multer');

const router = express.Router();

router.get('/', tourController.getAllTours);

router.get(
  '/company/me',
  authController.protect,
  authController.restrictTo('company'),
  tourController.getAllMyTours
);

router.get('/:id', tourController.GetTour);

router.post(
  '/',
  myMulter(fileValidation.image).single('image'),
  authController.protect,
  authController.restrictTo('company'),
  tourController.createTour
);

router
  .route('/:id')
  .delete(authController.protect, tourController.deleteTour)
  .patch(
    authController.protect,
    authController.restrictTo('company'),
    tourController.Updatetour
  );

module.exports = router;
