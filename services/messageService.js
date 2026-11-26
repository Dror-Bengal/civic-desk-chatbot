import { Message } from '../models/Message.js';

/**
 * Save a message to the database
 */
export async function save(conversationId, role, content, channelType, metadata = {}) {
  const message = await Message.create({
    conversationId,
    role,
    content,
    channelType,
    metadata
  });
  return message;
}

/**
 * Get conversation history for LLM context
 * Returns messages in chronological order
 */
export async function getHistory(conversationId, limit = 20) {
  const messages = await Message.find({ conversationId })
    .sort({ createdAt: -1, _id: -1 })
    .limit(limit)
    .lean();

  // Reverse to chronological order
  return messages.reverse();
}

/**
 * Get recent messages (most recent first)
 */
export async function getRecent(conversationId, limit = 10) {
  return Message.find({ conversationId })
    .sort({ createdAt: -1, _id: -1 })
    .limit(limit)
    .lean();
}

/**
 * Get all messages for a conversation (for research/debugging)
 */
export async function getAll(conversationId) {
  return Message.find({ conversationId })
    .sort({ createdAt: 1, _id: 1 })
    .lean();
}

/**
 * Search messages by content
 */
export async function search(query, options = {}) {
  const { conversationId, role, channelType, limit = 50 } = options;

  const filter = { $text: { $search: query } };
  if (conversationId) filter.conversationId = conversationId;
  if (role) filter.role = role;
  if (channelType) filter.channelType = channelType;

  return Message.find(filter)
    .sort({ score: { $meta: 'textScore' } })
    .limit(limit)
    .lean();
}

/**
 * Get messages by role (e.g., all assistant responses)
 */
export async function getByRole(role, options = {}) {
  const { conversationId, channelType, limit = 100 } = options;

  const filter = { role };
  if (conversationId) filter.conversationId = conversationId;
  if (channelType) filter.channelType = channelType;

  return Message.find(filter)
    .sort({ createdAt: -1, _id: -1 })
    .limit(limit)
    .lean();
}

/**
 * Count messages in a conversation
 */
export async function count(conversationId) {
  return Message.countDocuments({ conversationId });
}
