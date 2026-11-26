import { User } from '../models/User.js';

/**
 * Find or create a user by channel type and ID
 */
export async function findOrCreate(channelType, channelId, metadata = {}) {
  let user = await User.findOne({ channelType, channelId });

  if (!user) {
    user = await User.create({
      channelType,
      channelId,
      name: metadata.displayName || metadata.name || null,
      metadata: {
        ...metadata,
        firstSeenAt: new Date()
      }
    });
  }

  return user;
}

/**
 * Get user by ID
 */
export async function getById(userId) {
  return User.findById(userId);
}

/**
 * Update user metadata
 */
export async function updateMetadata(userId, metadata) {
  return User.findByIdAndUpdate(
    userId,
    { $set: { metadata } },
    { new: true }
  );
}

/**
 * Update user name
 */
export async function updateName(userId, name) {
  return User.findByIdAndUpdate(
    userId,
    { $set: { name } },
    { new: true }
  );
}

/**
 * Block a user
 */
export async function blockUser(userId) {
  return User.findByIdAndUpdate(
    userId,
    { $set: { isBlocked: true } },
    { new: true }
  );
}

/**
 * Unblock a user
 */
export async function unblockUser(userId) {
  return User.findByIdAndUpdate(
    userId,
    { $set: { isBlocked: false } },
    { new: true }
  );
}
