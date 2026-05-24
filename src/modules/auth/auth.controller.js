const { OAuth2Client } = require('google-auth-library');
const jwt = require('jsonwebtoken');
const config = require('../../config/env.config');
const User = require('../../../models/User');
const catchAsync = require('../../utils/catchAsync');
const AppError = require('../../utils/appError');
const { successResponse } = require('../../utils/response');

const googleClient = new OAuth2Client(config.google.clientId);

/**
 * Generate JWT token
 */
const generateToken = (userId) => {
  return jwt.sign({ id: userId }, config.jwt.secret, {
    expiresIn: config.jwt.expiresIn
  });
};

/**
 * Generate refresh token
 */
const generateRefreshToken = (userId) => {
  return jwt.sign({ id: userId }, config.jwt.refreshSecret, {
    expiresIn: config.jwt.refreshExpiresIn
  });
};

/**
 * @desc    Google Sign-In
 * @route   POST /api/v1/auth/google
 * @access  Public
 */
exports.googleSignIn = catchAsync(async (req, res, next) => {
  const { idToken } = req.body;

  if (!idToken) {
    return next(new AppError('ID token is required', 400));
  }

  // Verify Google token
  const ticket = await googleClient.verifyIdToken({
    idToken,
    audience: config.google.clientId
  });

  const payload = ticket.getPayload();
  const { sub: googleId, email, name, picture } = payload;

  // Find or create user
  let user = await User.findOne({ googleId });

  if (!user) {
    user = await User.create({
      googleId,
      email,
      displayName: name,
      photoUrl: picture
    });
  } else {
    // Update user info
    user.displayName = name;
    user.photoUrl = picture;
    await user.updateLastActive();
  }

  // Generate tokens
  const token = generateToken(user._id);
  const refreshToken = generateRefreshToken(user._id);

  successResponse(res, {
    user: {
      id: user._id,
      email: user.email,
      displayName: user.displayName,
      photoUrl: user.photoUrl,
      age: user.age,
      gender: user.gender,
      city: user.city,
      country: user.country,
      activityCategory: user.activityCategory
    },
    token,
    refreshToken
  }, 'Authentication successful', 200);
});

/**
 * @desc    Refresh access token
 * @route   POST /api/v1/auth/refresh
 * @access  Public
 */
exports.refreshToken = catchAsync(async (req, res, next) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    return next(new AppError('Refresh token is required', 400));
  }

  try {
    const decoded = jwt.verify(refreshToken, config.jwt.refreshSecret);

    const user = await User.findById(decoded.id);

    if (!user) {
      return next(new AppError('User not found', 404));
    }

    const newToken = generateToken(user._id);
    const newRefreshToken = generateRefreshToken(user._id);

    successResponse(res, {
      token: newToken,
      refreshToken: newRefreshToken
    }, 'Token refreshed successfully');

  } catch (error) {
    return next(new AppError('Invalid refresh token', 401));
  }
});

/**
 * @desc    Get current user
 * @route   GET /api/v1/auth/me
 * @access  Private
 */
exports.getMe = catchAsync(async (req, res, next) => {
  const user = await User.findById(req.user._id).select('-__v');

  successResponse(res, { user }, 'User retrieved successfully');
});

/**
 * @desc    Logout user
 * @route   POST /api/v1/auth/logout
 * @access  Private
 */
exports.logout = catchAsync(async (req, res, next) => {
  // In a production app, you might want to blacklist the token
  // For now, client-side token removal is sufficient

  successResponse(res, null, 'Logged out successfully');
});
