import * as messageService from '../services/messageService.js';

const MAX_HISTORY_MESSAGES = 20;

/**
 * Load chat history from MongoDB
 * Returns messages formatted for LLM context
 *
 * @param {string} conversationId - The conversation ID
 * @param {number} limit - Maximum number of messages to load
 * @returns {Array} Array of { role, content } objects
 */
export async function loadChatHistory(conversationId, limit = MAX_HISTORY_MESSAGES) {
  const messages = await messageService.getHistory(conversationId, limit);

  return messages.map(msg => ({
    role: msg.role,
    content: msg.content
  }));
}

/**
 * Add a message to the conversation history
 *
 * @param {string} conversationId - The conversation ID
 * @param {string} role - 'user' | 'assistant'
 * @param {string} content - The message content
 * @param {string} channelType - 'web' | 'whatsapp'
 * @param {Object} metadata - Additional metadata
 * @returns {Object} The saved message document
 */
export async function addMessage(conversationId, role, content, channelType, metadata = {}) {
  return messageService.save(conversationId, role, content, channelType, metadata);
}

/**
 * Format chat history for LLM input
 * Excludes the current message (last one) from history
 *
 * @param {string} conversationId - The conversation ID
 * @returns {Array} Array of { role, content } objects for prior messages
 */
export async function getHistoryForLLM(conversationId) {
  const history = await loadChatHistory(conversationId);

  // If there are messages, exclude the last one (current message)
  // as it will be passed separately to the LLM
  if (history.length > 0) {
    return history.slice(0, -1);
  }

  return [];
}
