import { Conversation } from '../models/Conversation.js';

/**
 * Find or create an active conversation for a user
 */
export async function findOrCreateActive(userId, channelType) {
  let conversation = await Conversation.findOne({
    userId,
    status: 'active'
  });

  if (!conversation) {
    conversation = await Conversation.create({
      userId,
      channelType,
      status: 'active',
      messageCount: 0
    });
  }

  return conversation;
}

/**
 * Update conversation after a message exchange
 */
export async function updateAfterExchange(conversationId, options = {}) {
  const {
    incrementMessages = 2,
    lastMessageAt = new Date(),
    generateTopic = false,
    firstUserMessage = null
  } = options;

  const update = {
    $inc: { messageCount: incrementMessages },
    $set: { lastMessageAt }
  };

  // Auto-generate topic from first user message
  if (generateTopic && firstUserMessage) {
    // Take first 100 chars as topic
    const topic = firstUserMessage.slice(0, 100).trim();
    update.$set.topic = topic;
  }

  return Conversation.findByIdAndUpdate(conversationId, update, { new: true });
}

/**
 * Update conversation topic
 */
export async function updateTopic(conversationId, topic) {
  return Conversation.findByIdAndUpdate(
    conversationId,
    { $set: { topic } },
    { new: true }
  );
}

/**
 * Update conversation summary
 */
export async function updateSummary(conversationId, summary) {
  return Conversation.findByIdAndUpdate(
    conversationId,
    { $set: { summary } },
    { new: true }
  );
}

/**
 * Archive a conversation
 */
export async function archive(conversationId) {
  return Conversation.findByIdAndUpdate(
    conversationId,
    { $set: { status: 'archived' } },
    { new: true }
  );
}

/**
 * Get conversation by ID
 */
export async function getById(conversationId) {
  return Conversation.findById(conversationId);
}

/**
 * Archive all active conversations (used when system prompt changes)
 */
export async function archiveAll() {
  const result = await Conversation.updateMany(
    { status: 'active' },
    { $set: { status: 'archived' } }
  );
  return result.modifiedCount;
}

/**
 * Get all conversations for a user
 */
export async function getByUserId(userId, includeArchived = false) {
  const query = { userId };
  if (!includeArchived) {
    query.status = 'active';
  }
  return Conversation.find(query).sort({ lastMessageAt: -1 });
}
