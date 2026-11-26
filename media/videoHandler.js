/**
 * Video Handler
 *
 * Gemini handles video natively. We convert the buffer to base64
 * and return it for multimodal processing.
 */

/**
 * Process video for Gemini
 * Returns multimodal content that can be sent to Gemini
 */
export async function handleVideo(buffer, mimeType, caption = null) {
  const base64Video = buffer.toString('base64');

  const content = [
    {
      type: 'media',
      mimeType: mimeType || 'video/mp4',
      data: base64Video
    }
  ];

  // Add caption or default instruction
  const textInstruction = caption
    ? `The user sent a video with the caption: "${caption}". Describe what you see and respond to their message.`
    : 'The user sent a video. Describe what you see and respond appropriately.';

  content.push({
    type: 'text',
    text: textInstruction
  });

  return {
    multimodalContent: content,
    processingMethod: 'gemini-native-video',
    textContent: null
  };
}
