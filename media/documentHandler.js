import pdf from 'pdf-parse';
import mammoth from 'mammoth';

/**
 * Document Handler
 *
 * Extracts text from PDF and Word documents.
 * Returns extracted text for LLM processing.
 */

const MAX_TEXT_LENGTH = 5000;

/**
 * Process document and extract text
 * Returns text content for LLM input
 */
export async function handleDocument(buffer, mimeType, caption = null) {
  let extractedText = '';

  try {
    if (mimeType === 'application/pdf') {
      const data = await pdf(buffer);
      extractedText = data.text;
    } else if (
      mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      mimeType === 'application/msword'
    ) {
      const result = await mammoth.extractRawText({ buffer });
      extractedText = result.value;
    } else if (mimeType === 'text/plain') {
      extractedText = buffer.toString('utf-8');
    } else {
      throw new Error(`Unsupported document type: ${mimeType}`);
    }

    // Truncate if too long
    if (extractedText.length > MAX_TEXT_LENGTH) {
      extractedText = extractedText.slice(0, MAX_TEXT_LENGTH) + '... [Document truncated]';
    }

    // Clean up whitespace
    extractedText = extractedText.replace(/\s+/g, ' ').trim();

    const textContent = caption
      ? `The user sent a document with the caption: "${caption}"\n\nDocument content:\n${extractedText}`
      : `The user sent a document. Here is the content:\n\n${extractedText}`;

    return {
      multimodalContent: null,
      processingMethod: 'text-extraction',
      textContent
    };
  } catch (error) {
    console.error('Error extracting document text:', error.message);
    return {
      multimodalContent: null,
      processingMethod: 'text-extraction-failed',
      textContent: caption
        ? `The user sent a document with caption: "${caption}" but the content could not be extracted. Ask them to describe what's in the document.`
        : 'The user sent a document but the content could not be extracted. Ask them to describe what\'s in the document.'
    };
  }
}
