const express = require('express');
const { myMulter, fileValidation } = require('../utils/multer');
const tripProgramController = require('../controllers/tripProgramController');
const authController = require('../controllers/authController');

const router = express.Router();

router.get('/', tripProgramController.GetAllTripProgram);

router.get(
  '/company/me',
  authController.protect,
  authController.restrictTo('company'),
  tripProgramController.getAllMyTripPrograms
);

router.get('/:id', tripProgramController.GetTripProgram);

router.use(authController.protect);
router.use(authController.restrictTo('admin', 'company'));

router
  .route('/')
  .post(
    myMulter(fileValidation.image).single('image'),
    tripProgramController.createTripProgram
  );

router
  .route('/:id')
  .delete(tripProgramController.deleteTripProgram)
  .patch(
    myMulter(fileValidation.image).single('image'),
    tripProgramController.UpdateTripProgram
  );

module.exports = router;
