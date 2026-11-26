import { downloadWhatsAppMedia, downloadTelegramMedia } from './downloader.js';
import { handleAudio } from './audioHandler.js';
import { handleImage } from './imageHandler.js';
import { handleVideo } from './videoHandler.js';
import { handleDocument } from './documentHandler.js';
import { handleSticker } from './stickerHandler.js';

/**
 * Media Processor
 *
 * Main entry point for processing media from any channel.
 * Routes media to appropriate handlers based on type.
 */

/**
 * Process media and return content for LLM
 *
 * @param {Object} options
 * @param {string} options.mediaType - 'audio' | 'image' | 'video' | 'document' | 'sticker' | 'location' | 'contacts'
 * @param {string} options.mediaId - WhatsApp media ID (for downloading)
 * @param {string} options.mediaUrl - Direct URL (for non-WhatsApp sources)
 * @param {string} options.mediaMime - MIME type if known
 * @param {string} options.channelType - 'whatsapp' | 'web'
 * @param {string} options.text - Caption or accompanying text
 * @param {Object} options.raw - Raw payload for location/contacts
 *
 * @returns {Object} {
 *   textContent: String | null,       // For text-only LLM input
 *   multimodalContent: Array | null,  // For multimodal LLM input
 *   originalMediaType: String,
 *   processingMethod: String
 * }
 */
export async function processMedia(options) {
  const {
    mediaType,
    mediaId,
    mediaUrl,
    mediaMime,
    channelType,
    text: caption,
    raw
  } = options;

  const startTime = Date.now();

  try {
    // Handle location (no download needed)
    if (mediaType === 'location') {
      return handleLocation(raw, caption);
    }

    // Handle contacts (no download needed)
    if (mediaType === 'contacts') {
      return handleContacts(raw, caption);
    }

    // Download media
    let mediaData;
    if (channelType === 'whatsapp' && mediaId) {
      mediaData = await downloadWhatsAppMedia(mediaId);
    } else if (channelType === 'telegram' && mediaId) {
      mediaData = await downloadTelegramMedia(mediaId);

    } else {
      throw new Error('No media ID or URL provided');
    }

    const { buffer, mimeType } = mediaData;
    const finalMimeType = mediaMime || mimeType;

    // Route to appropriate handler
    let result;
    switch (mediaType) {
      case 'audio':
        result = await handleAudio(buffer, finalMimeType);
        break;
      case 'image':
        result = await handleImage(buffer, finalMimeType, caption);
        break;
      case 'video':
        result = await handleVideo(buffer, finalMimeType, caption);
        break;
      case 'document':
        result = await handleDocument(buffer, finalMimeType, caption);
        break;
      case 'sticker':
        result = await handleSticker(buffer, finalMimeType);
        break;
      default:
        result = {
          textContent: `[User sent unsupported media type: ${mediaType}]`,
          multimodalContent: null,
          processingMethod: 'unsupported'
        };
    }

    return {
      ...result,
      originalMediaType: mediaType,
      processingTimeMs: Date.now() - startTime
    };

  } catch (error) {
    console.error('Media processing error:', error.message);
    return {
      textContent: '[User sent media that could not be processed. Ask them to describe it in text.]',
      multimodalContent: null,
      originalMediaType: mediaType,
      processingMethod: 'error',
      error: error.message,
      processingTimeMs: Date.now() - startTime
    };
  }
}

/**
 * Handle location messages
 */
function handleLocation(raw, caption) {
  const { latitude, longitude, name, address } = raw || {};

  let locationText = 'The user shared their location';
  if (name) locationText += `: ${name}`;
  if (address) locationText += ` (${address})`;
  locationText += `. Coordinates: ${latitude}, ${longitude}`;
  if (caption) locationText += `\nCaption: ${caption}`;

  return {
    textContent: locationText,
    multimodalContent: null,
    originalMediaType: 'location',
    processingMethod: 'location-text',
    processingTimeMs: 0
  };
}

/**
 * Handle contacts messages
 */
function handleContacts(raw, caption) {
  const contacts = raw?.contacts || [];

  let contactsText = 'The user shared contact(s):\n';
  for (const contact of contacts) {
    const name = contact.name?.formatted_name || 'Unknown';
    const phones = contact.phones?.map(p => p.phone).join(', ') || 'No phone';
    contactsText += `- ${name}: ${phones}\n`;
  }
  if (caption) contactsText += `\nCaption: ${caption}`;

  return {
    textContent: contactsText.trim(),
    multimodalContent: null,
    originalMediaType: 'contacts',
    processingMethod: 'contacts-text',
    processingTimeMs: 0
  };
}
