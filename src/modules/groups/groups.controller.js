const { prisma } = require('../../config/postgres.config');
const User = require('../../../models/User');
const catchAsync = require('../../utils/catchAsync');
const AppError = require('../../utils/appError');
const { successResponse } = require('../../utils/response');

const PRIVACIES = ['PUBLIC', 'PRIVATE', 'INVITE_ONLY'];

// Build { groupId: activeMemberCount } in one query.
async function memberCounts(groupIds) {
  if (groupIds.length === 0) return {};
  const rows = await prisma.groupMember.groupBy({
    by: ['groupId'],
    where: { groupId: { in: groupIds }, isActive: true },
    _count: { userId: true },
  });
  return Object.fromEntries(rows.map(r => [r.groupId, r._count.userId]));
}

function shape(group, count, isMember) {
  return {
    id: group.id,
    name: group.name,
    description: group.description,
    privacy: group.privacy,
    maxMembers: group.maxMembers,
    imageUrl: group.imageUrl,
    memberCount: count || 0,
    isMember: !!isMember,
  };
}

// ─────────────────────────────────────────────────────────────
// GET /api/v1/groups  — browse active groups
// ─────────────────────────────────────────────────────────────
exports.listGroups = catchAsync(async (req, res) => {
  const userId = req.user._id.toString();

  const groups = await prisma.runningGroup.findMany({
    where: { isActive: true },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
  const counts = await memberCounts(groups.map(g => g.id));
  const myMemberships = await prisma.groupMember.findMany({
    where: { userId, isActive: true },
    select: { groupId: true },
  });
  const mySet = new Set(myMemberships.map(m => m.groupId));

  successResponse(res, {
    groups: groups.map(g => shape(g, counts[g.id], mySet.has(g.id))),
  }, 'Groups retrieved successfully');
});

// ─────────────────────────────────────────────────────────────
// GET /api/v1/groups/mine  — groups the user belongs to
// ─────────────────────────────────────────────────────────────
exports.myGroups = catchAsync(async (req, res) => {
  const userId = req.user._id.toString();

  const memberships = await prisma.groupMember.findMany({
    where: { userId, isActive: true },
    include: { group: true },
  });
  const activeGroups = memberships.filter(m => m.group && m.group.isActive).map(m => m.group);
  const counts = await memberCounts(activeGroups.map(g => g.id));

  successResponse(res, {
    groups: activeGroups.map(g => shape(g, counts[g.id], true)),
  }, 'My groups retrieved successfully');
});

// ─────────────────────────────────────────────────────────────
// POST /api/v1/groups  — create a group (creator becomes OWNER)
// ─────────────────────────────────────────────────────────────
exports.createGroup = catchAsync(async (req, res, next) => {
  const userId = req.user._id.toString();
  const { name, description, privacy, maxMembers, imageUrl } = req.body;

  if (!name || name.trim().length < 3) {
    return next(new AppError('Group name must be at least 3 characters', 400));
  }
  const groupPrivacy = PRIVACIES.includes(privacy) ? privacy : 'PUBLIC';

  const group = await prisma.runningGroup.create({
    data: {
      name: name.trim(),
      description: description || null,
      privacy: groupPrivacy,
      maxMembers: Number.isInteger(maxMembers) && maxMembers > 0 ? Math.min(maxMembers, 500) : 50,
      imageUrl: imageUrl || null,
      creatorId: userId,
    },
  });
  await prisma.groupMember.create({
    data: { groupId: group.id, userId, role: 'OWNER' },
  });

  successResponse(res, { group: shape(group, 1, true) }, 'Group created successfully', 201);
});

// ─────────────────────────────────────────────────────────────
// POST /api/v1/groups/:id/join
// ─────────────────────────────────────────────────────────────
exports.joinGroup = catchAsync(async (req, res, next) => {
  const userId = req.user._id.toString();
  const groupId = req.params.id;

  const group = await prisma.runningGroup.findUnique({ where: { id: groupId } });
  if (!group || !group.isActive) return next(new AppError('Group not found', 404));
  if (group.privacy !== 'PUBLIC') {
    return next(new AppError('This group is not open to join', 403));
  }

  const existing = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId, userId } },
  });
  if (existing && existing.isActive) {
    return next(new AppError('Already a member', 400));
  }

  const activeCount = await prisma.groupMember.count({ where: { groupId, isActive: true } });
  if (activeCount >= group.maxMembers) {
    return next(new AppError('Group is full', 400));
  }

  if (existing) {
    await prisma.groupMember.update({
      where: { groupId_userId: { groupId, userId } },
      data: { isActive: true, role: 'MEMBER' },
    });
  } else {
    await prisma.groupMember.create({ data: { groupId, userId, role: 'MEMBER' } });
  }

  successResponse(res, { group: shape(group, activeCount + 1, true) }, 'Joined group successfully');
});

// ─────────────────────────────────────────────────────────────
// DELETE /api/v1/groups/:id/leave
// ─────────────────────────────────────────────────────────────
exports.leaveGroup = catchAsync(async (req, res, next) => {
  const userId = req.user._id.toString();
  const groupId = req.params.id;

  const existing = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId, userId } },
  });
  if (!existing || !existing.isActive) {
    return next(new AppError('You are not a member of this group', 400));
  }

  await prisma.groupMember.update({
    where: { groupId_userId: { groupId, userId } },
    data: { isActive: false },
  });

  successResponse(res, null, 'Left group successfully');
});

// ─────────────────────────────────────────────────────────────
// GET /api/v1/groups/:id  — detail with member names (cross-DB)
// ─────────────────────────────────────────────────────────────
exports.getGroup = catchAsync(async (req, res, next) => {
  const userId = req.user._id.toString();
  const groupId = req.params.id;

  const group = await prisma.runningGroup.findUnique({
    where: { id: groupId },
    include: { members: { where: { isActive: true } } },
  });
  if (!group || !group.isActive) return next(new AppError('Group not found', 404));

  const memberIds = group.members.map(m => m.userId);
  const users = await User.find({ _id: { $in: memberIds } }).select('displayName photoUrl city').lean();
  const userMap = Object.fromEntries(users.map(u => [u._id.toString(), u]));

  const members = group.members.map(m => ({
    userId: m.userId,
    role: m.role,
    displayName: userMap[m.userId]?.displayName || 'Usuario',
    photoUrl: userMap[m.userId]?.photoUrl || null,
  }));

  successResponse(res, {
    group: { ...shape(group, members.length, memberIds.includes(userId)), members },
  }, 'Group retrieved successfully');
});
