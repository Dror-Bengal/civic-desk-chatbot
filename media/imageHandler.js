/**
 * Image Handler
 *
 * Processes images for Gemini vision capabilities.
 * Converts image buffer to base64 for multimodal input.
 */

/**
 * Process image for Gemini vision
 * Returns multimodal content that can be sent to Gemini
 */
export async function handleImage(buffer, mimeType, caption = null) {
  const base64Image = buffer.toString('base64');

  const content = [
    {
      type: 'image_url',
      image_url: {
        url: `data:${mimeType || 'image/jpeg'};base64,${base64Image}`
      }
    }
  ];

  // Add caption or default instruction
  const textInstruction = caption
    ? `The user sent an image with the caption: "${caption}". Describe what you see and respond to their message.`
    : 'The user sent an image. Describe what you see and respond appropriately.';

  content.push({
    type: 'text',
    text: textInstruction
  });

  return {
    multimodalContent: content,
    processingMethod: 'gemini-vision',
    textContent: null
  };
}
