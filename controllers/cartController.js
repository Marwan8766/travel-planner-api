const Cart = require('../models/cartModel');
const Availability = require('../models/availabilityModel');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');

exports.addToCart = catchAsync(async (req, res, next) => {
  console.log(`req.body: ${JSON.stringify(req.body)}`);

  // get data from body
  const { cartItem } = req.body;

  const cart = await Cart.findOne({ user: req.user._id });

  if (!cart) return next(new AppError('Cart not found', 404));

  // if there is an cartItem add it to the cart
  cart.items.push(cartItem);

  const updatedCart = await cart.save({ validateModifiedOnly: true });

  if (!updatedCart)
    return next(new AppError('Error adding this item to the cart', 400));

  res.status(200).json({
    status: 'success',
    data: {
      cart: updatedCart,
    },
  });
});

exports.createCartItems = catchAsync(async (req, res, next) => {
  console.log(`req.body: ${JSON.stringify(req.body)}`);

  const { cartItems } = req.body;
  const cart = await Cart.create({ user: req.user._id, items: cartItems });
  if (!cart) return next(new AppError('Error creating cart', 400));

  res.status(200).json({
    status: 'success',
    data: {
      cart,
    },
  });
});

exports.checkAddedItemsAddAvailability = catchAsync(async (req, res, next) => {
  // get data from body
  console.log(`req.body: ${JSON.stringify(req.body)}`);

  const { cartItems, cartItem } = req.body;

  // check that the cartItems or cartItem is provided
  if (!cartItems && !cartItem)
    return next(
      new AppError(
        'You must provide cartItems if it is the first time to add to cart or cartItem if you already have a cart',
        400
      )
    );

  // check the availability of the cartItems or cartItem
  if (cartItems && cartItems.length) {
    // loop over each cartItem and check its availability
    for (const item of cartItems) {
      console.log(`current checked item avilability in cart: ${item}`);
      if (item.type === 'tour') {
        const availability = await Availability.findOne({
          tour: item.tour,
          date: item.date,
        });
        if (!availability || availability.availableSeats - item.quantity < 0) {
          return next(new AppError('this tour quantity isnot available', 404));
        }
      } else if (item.type === 'tripProgram') {
        const availability = await Availability.findOne({
          tripProgram: item.tripProgram,
          date: new Date(item.date),
        });
        console.log(`avilability: ${availability}`);
        console.log(`quantity: ${item.quantity}`);
        console.log(
          `error condition seats-quantity: ${
            availability.availableSeats - item.quantity < 0
          }`
        );
        if (!availability || availability.availableSeats - item.quantity < 0) {
          return next(
            new AppError('this tripProgram quantity isnot available', 404)
          );
        }
      }
    }
  } else {
    if (cartItem.type === 'tour') {
      const availability = await Availability.findOne({
        tour: cartItem.tour,
        date: cartItem.date,
      });
      if (
        !availability ||
        availability.availableSeats - cartItem.quantity < 0 ||
        availability.date < cartItem.date
      ) {
        return next(new AppError('this tour isnot available', 404));
      }
    } else if (cartItem.type === 'tripProgram') {
      const availability = await Availability.findOne({
        tripProgram: cartItem.tripProgram,
        date: cartItem.date,
      });
      if (
        !availability ||
        availability.availableSeats - cartItem.quantity < 0 ||
        availability.date < cartItem.date
      ) {
        return next(new AppError('this tripProgram isnot available', 404));
      }
    }
  }
  // if everything is ok return next
  next();
});

exports.checkCartItemsAvailability = catchAsync(async (req, res, next) => {
  // Find the cart for the current user
  const cart = await Cart.findOne({ user: req.user._id });
  if (!cart) return next(new AppError('Cart not found', 404));

  // Add the updated cart to the request object and continue
  req.cart = cart;
  next();
});

exports.deleteCartItem = catchAsync(async (req, res, next) => {
  const { itemId } = req.body;
  console.log(`itemId:  ${itemId}`);

  // Find the cart for the current user
  const cart = await Cart.findOne({ user: req.user._id });
  if (!cart) return next(new AppError('Cart not found', 404));

  if (cart.items.length === 0) return next(new AppError('Cart is empty', 404));

  // Find the item in the cart that matches the given itemId
  const itemIndex = cart.items.findIndex((cartItem) => {
    if (cartItem._id && cartItem._id.toString() === itemId.toString())
      return true;
    // Uncomment the following lines if you want to match the itemId in the tripProgram field
    // if (
    //   cartItem.tripProgram &&
    //   cartItem.tripProgram.toString() === itemId.toString()
    // )
    //   return true;
  });

  // If item not found, return an error.
  if (itemIndex === -1) return next(new AppError('Item not found', 404));

  const cartItem = cart.items[itemIndex];

  if (cartItem && cartItem.quantity > 1) {
    cart.items[itemIndex].quantity--;
  } else {
    // Remove the item from the cart
    cart.items.splice(itemIndex, 1);
  }

  // Save the updated cart to the database
  const updatedCart = await cart.save({ validateModifiedOnly: true });

  // If there was an error saving the updated cart, return an error
  if (!updatedCart) return next(new AppError('Error deleting the item', 400));

  // If the cart was successfully updated, return a success response
  res.status(204).json({
    status: 'success',
    data: {
      cart: updatedCart,
    },
  });
});

exports.emptyCart = catchAsync(async (req, res, next) => {
  // Find the cart for the current user
  const cart = await Cart.findOne({ user: req.user._id });
  if (!cart) return next(new AppError('cart not found', 404));

  if (cart.items.length === 0) return next(new AppError('cart is empty', 404));

  // delete all items at cart
  cart.items = [];

  // save the cart
  const updatedCart = await cart.save({ validateModifiedOnly: true });
  if (!updatedCart) return next(new AppError('Error emptying the cart', 400));

  // return the res
  res.status(204).json({
    status: 'success',
    data: {
      cart: updatedCart,
    },
  });
});

exports.getCart = catchAsync(async (req, res, next) => {
  const cart = await Cart.findOne({ user: req.user._id });
  if (!cart) return next(new AppError('cart not found', 404));
  res.status(200).json({
    status: 'success',
    data: {
      cart,
    },
  });
});
