const { prisma } = require('../../config/postgres.config');
const User = require('../../../models/User');
const catchAsync = require('../../utils/catchAsync');
const AppError = require('../../utils/appError');
const { successResponse } = require('../../utils/response');

/**
 * @desc    Send friend request
 * @route   POST /api/v1/friends/request
 * @access  Private
 */
exports.sendFriendRequest = catchAsync(async (req, res, next) => {
  const requesterId = req.user._id.toString();
  const { addresseeId } = req.body;

  if (requesterId === addresseeId) {
    return next(new AppError('Cannot send friend request to yourself', 400));
  }

  // Check if addressee exists
  const addressee = await User.findById(addresseeId);
  if (!addressee) {
    return next(new AppError('User not found', 404));
  }

  // Check if friendship already exists
  const existingFriendship = await prisma.friendship.findFirst({
    where: {
      OR: [
        { requesterId, addresseeId },
        { requesterId: addresseeId, addresseeId: requesterId }
      ]
    }
  });

  if (existingFriendship) {
    return next(new AppError('Friendship already exists', 400));
  }

  // Create friend request
  const friendship = await prisma.friendship.create({
    data: {
      requesterId,
      addresseeId,
      status: 'PENDING'
    }
  });

  successResponse(res, { friendship }, 'Friend request sent successfully', 201);
});

/**
 * @desc    Accept friend request
 * @route   PUT /api/v1/friends/accept/:friendshipId
 * @access  Private
 */
exports.acceptFriendRequest = catchAsync(async (req, res, next) => {
  const userId = req.user._id.toString();
  const { friendshipId } = req.params;

  const friendship = await prisma.friendship.findUnique({
    where: { id: friendshipId }
  });

  if (!friendship) {
    return next(new AppError('Friend request not found', 404));
  }

  if (friendship.addresseeId !== userId) {
    return next(new AppError('Not authorized to accept this request', 403));
  }

  if (friendship.status !== 'PENDING') {
    return next(new AppError('Friend request is not pending', 400));
  }

  const updatedFriendship = await prisma.friendship.update({
    where: { id: friendshipId },
    data: { status: 'ACCEPTED' }
  });

  successResponse(res, { friendship: updatedFriendship }, 'Friend request accepted');
});

/**
 * @desc    Reject friend request
 * @route   PUT /api/v1/friends/reject/:friendshipId
 * @access  Private
 */
exports.rejectFriendRequest = catchAsync(async (req, res, next) => {
  const userId = req.user._id.toString();
  const { friendshipId } = req.params;

  const friendship = await prisma.friendship.findUnique({
    where: { id: friendshipId }
  });

  if (!friendship) {
    return next(new AppError('Friend request not found', 404));
  }

  if (friendship.addresseeId !== userId) {
    return next(new AppError('Not authorized to reject this request', 403));
  }

  const updatedFriendship = await prisma.friendship.update({
    where: { id: friendshipId },
    data: { status: 'REJECTED' }
  });

  successResponse(res, { friendship: updatedFriendship }, 'Friend request rejected');
});

/**
 * @desc    Get friends list
 * @route   GET /api/v1/friends
 * @access  Private
 */
exports.getFriends = catchAsync(async (req, res, next) => {
  const userId = req.user._id.toString();

  const friendships = await prisma.friendship.findMany({
    where: {
      OR: [
        { requesterId: userId, status: 'ACCEPTED' },
        { addresseeId: userId, status: 'ACCEPTED' }
      ]
    }
  });

  // Get friend user IDs
  const friendIds = friendships.map(f =>
    f.requesterId === userId ? f.addresseeId : f.requesterId
  );

  // Fetch friend details from MongoDB
  const friends = await User.find({
    _id: { $in: friendIds }
  }).select('displayName email photoUrl city country');

  successResponse(res, { friends }, 'Friends list retrieved successfully');
});

/**
 * @desc    Get pending friend requests
 * @route   GET /api/v1/friends/pending
 * @access  Private
 */
exports.getPendingRequests = catchAsync(async (req, res, next) => {
  const userId = req.user._id.toString();

  const pendingRequests = await prisma.friendship.findMany({
    where: {
      addresseeId: userId,
      status: 'PENDING'
    },
    orderBy: { createdAt: 'desc' }
  });

  // Get requester details
  const requesterIds = pendingRequests.map(r => r.requesterId);
  const requesters = await User.find({
    _id: { $in: requesterIds }
  }).select('displayName email photoUrl');

  const requestsWithDetails = pendingRequests.map(request => {
    const requester = requesters.find(u => u._id.toString() === request.requesterId);
    return {
      ...request,
      requester
    };
  });

  successResponse(res, { requests: requestsWithDetails }, 'Pending requests retrieved successfully');
});

/**
 * @desc    Remove friend
 * @route   DELETE /api/v1/friends/:friendshipId
 * @access  Private
 */
exports.removeFriend = catchAsync(async (req, res, next) => {
  const userId = req.user._id.toString();
  const { friendshipId } = req.params;

  const friendship = await prisma.friendship.findUnique({
    where: { id: friendshipId }
  });

  if (!friendship) {
    return next(new AppError('Friendship not found', 404));
  }

  if (friendship.requesterId !== userId && friendship.addresseeId !== userId) {
    return next(new AppError('Not authorized to remove this friendship', 403));
  }

  await prisma.friendship.delete({
    where: { id: friendshipId }
  });

  successResponse(res, null, 'Friend removed successfully');
});
