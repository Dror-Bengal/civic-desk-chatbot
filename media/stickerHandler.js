import sharp from 'sharp';
import { handleImage } from './imageHandler.js';

/**
 * Sticker Handler
 *
 * WhatsApp stickers are typically WebP format.
 * We convert to PNG for better compatibility with Gemini vision.
 */

/**
 * Process sticker for Gemini vision
 * Converts WebP to PNG and passes to image handler
 */
export async function handleSticker(buffer, mimeType) {
  try {
    // Convert WebP to PNG using sharp
    const pngBuffer = await sharp(buffer)
      .png()
      .toBuffer();

    // Process as image
    const result = await handleImage(pngBuffer, 'image/png');

    // Override the instruction for sticker context
    result.multimodalContent[1] = {
      type: 'text',
      text: 'The user sent a sticker. Describe what you see in the sticker and respond appropriately with a friendly tone.'
    };

    result.processingMethod = 'sticker-to-image';
    return result;
  } catch (error) {
    console.error('Error processing sticker:', error.message);
    return {
      multimodalContent: null,
      processingMethod: 'sticker-processing-failed',
      textContent: 'The user sent a sticker that could not be processed.'
    };
  }
}
