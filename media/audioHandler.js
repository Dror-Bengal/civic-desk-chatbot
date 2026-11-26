/**
 * Audio Handler
 *
 * Gemini handles audio natively, including OGG/OPUS format used by WhatsApp voice notes.
 * We simply convert the buffer to base64 and return it for multimodal processing.
 */

/**
 * Process audio for Gemini
 * Returns multimodal content that can be sent to Gemini
 */
export async function handleAudio(buffer, mimeType) {
  const base64Audio = buffer.toString('base64');

  return {
    multimodalContent: [
      {
        type: 'media',
        mimeType: mimeType || 'audio/ogg',
        data: base64Audio
      },
      {
        type: 'text',
        text: 'The user sent a voice message. Listen to it and respond appropriately.'
      }
    ],
    processingMethod: 'gemini-native-audio',
    textContent: null
  };
}
