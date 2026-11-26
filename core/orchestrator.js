import * as userService from '../services/userService.js';
import * as conversationService from '../services/conversationService.js';
import { addMessage, loadChatHistory } from './memoryManager.js';
import { getResponse } from './llmCore.js';
import { processMedia } from '../media/mediaProcessor.js';

/**
 * Central message processing pipeline
 *
 * Handles the full flow:
 * 1. Resolve user (find or create)
 * 2. Resolve conversation (find or create active)
 * 3. Process media if present
 * 4. Save user message
 * 5. Load chat history
 * 6. Generate LLM response
 * 7. Save assistant response
 * 8. Update conversation metadata
 *
 * @param {Object} inboundMessage - Normalized inbound message
 * @param {string} inboundMessage.channelType - 'web' | 'whatsapp'
 * @param {string} inboundMessage.channelId - Unique sender ID within channel
 * @param {string} inboundMessage.text - User's text message (null if media-only)
 * @param {string} inboundMessage.mediaType - 'audio' | 'image' | 'video' | 'document' | 'sticker' | 'location' | 'contacts' | null
 * @param {string} inboundMessage.mediaUrl - URL to download media
 * @param {string} inboundMessage.mediaId - Platform-specific media ID
 * @param {string} inboundMessage.mediaMime - MIME type
 * @param {Object} inboundMessage.raw - Full original payload
 * @param {Object} inboundMessage.metadata - Optional channel-specific data
 *
 * @returns {Object} { success, response, conversationId, userId, processingTimeMs }
 */
export async function handleMessage(inboundMessage) {
  const startTime = Date.now();
  const {
    channelType,
    channelId,
    text,
    mediaType,
    mediaUrl,
    mediaId,
    mediaMime,
    raw,
    metadata = {}
  } = inboundMessage;

  try {
    // Step 1: Resolve or create user
    const user = await userService.findOrCreate(channelType, channelId, metadata);

    // Check if user is blocked
    if (user.isBlocked) {
      return {
        success: false,
        error: 'User is blocked',
        shouldRespond: false
      };
    }

    // Step 2: Resolve or create active conversation
    const conversation = await conversationService.findOrCreateActive(user._id, channelType);
    const isFirstExchange = conversation.messageCount === 0;

    // Step 3: Process media if present
    let llmInput = { userMessage: text };
    let mediaMetadata = {};

    if (mediaType) {
      const processed = await processMedia({
        mediaType,
        mediaId,
        mediaUrl,
        mediaMime,
        channelType,
        text,
        raw
      });

      if (processed.multimodalContent) {
        // Multimodal input (image, audio, video)
        llmInput = {
          multimodalContent: processed.multimodalContent,
          userMessage: null
        };
      } else {
        // Text-only input (document, location, contacts, or fallback)
        llmInput = {
          userMessage: processed.textContent || text || `[${mediaType}]`,
          multimodalContent: null
        };
      }

      mediaMetadata = {
        originalMediaType: mediaType,
        processingMethod: processed.processingMethod,
        processingTimeMs: processed.processingTimeMs
      };

      if (processed.error) {
        mediaMetadata.processingError = processed.error;
      }
    }

    // Step 4: Load chat history BEFORE saving user message (avoids slice operation)
    const messageText = llmInput.userMessage || text || `[${mediaType || 'unknown'}]`;
    const chatHistory = await loadChatHistory(conversation._id);

    // Step 6: Generate LLM response
    const llmResult = await getResponse({
      userMessage: llmInput.userMessage,
      multimodalContent: llmInput.multimodalContent,
      chatHistory,
      userId: user._id.toString(),
      conversationId: conversation._id.toString(),
      channelType
    });

    // Step 5: Save user message (after loading history so it's not included)
    await addMessage(
      conversation._id,
      'user',
      messageText,
      channelType,
      { ...metadata, ...mediaMetadata }
    );

    // Step 7 & 8: Save assistant response AND update conversation metadata in parallel
    await Promise.all([
      addMessage(
        conversation._id,
        'assistant',
        llmResult.text,
        channelType,
        {
          tokensUsed: llmResult.metadata?.tokensUsed,
          model: llmResult.metadata?.model
        }
      ),
      conversationService.updateAfterExchange(conversation._id, {
        incrementMessages: 2, // user + assistant
        lastMessageAt: new Date(),
        generateTopic: isFirstExchange,
        firstUserMessage: isFirstExchange ? messageText : null
      })
    ]);

    return {
      success: true,
      response: llmResult.text,
      conversationId: conversation._id.toString(),
      userId: user._id.toString(),
      processingTimeMs: Date.now() - startTime
    };

  } catch (error) {
    console.error('Conversation processing failed.');
    return {
      success: false,
      error: error.message,
      processingTimeMs: Date.now() - startTime
    };
  }
}
