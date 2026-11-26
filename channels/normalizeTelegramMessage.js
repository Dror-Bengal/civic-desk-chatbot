export function normalizeTelegramMessage(message) {
  const result = {
    text: null,
    mediaType: null,
    mediaId: null,
    mediaUrl: null,
    mediaMime: null,
    raw: message,
  };

  // Text message
  if (message.text) {
    result.text = message.text;
    return result;
  }

  // Photo — Telegram sends an array of sizes, pick the largest
  if (message.photo) {
    const largest = message.photo[message.photo.length - 1];
    result.mediaType = 'image';
    result.mediaId = largest.file_id;
    result.text = message.caption || null;
    return result;
  }

  // Voice note
  if (message.voice) {
    result.mediaType = 'audio';
    result.mediaId = message.voice.file_id;
    result.mediaMime = message.voice.mime_type || 'audio/ogg';
    return result;
  }

  // Audio file
  if (message.audio) {
    result.mediaType = 'audio';
    result.mediaId = message.audio.file_id;
    result.mediaMime = message.audio.mime_type;
    result.text = message.caption || null;
    return result;
  }

  // Video
  if (message.video) {
    result.mediaType = 'video';
    result.mediaId = message.video.file_id;
    result.mediaMime = message.video.mime_type;
    result.text = message.caption || null;
    return result;
  }

  // Document
  if (message.document) {
    result.mediaType = 'document';
    result.mediaId = message.document.file_id;
    result.mediaMime = message.document.mime_type;
    result.text = message.caption || null;
    return result;
  }

  // Sticker
  if (message.sticker) {
    result.mediaType = 'sticker';
    result.mediaId = message.sticker.file_id;
    result.mediaMime = 'image/webp';
    return result;
  }

  // Location — normalize to match mediaProcessor's expected format
  if (message.location) {
    result.mediaType = 'location';
    result.raw = {
      latitude: message.location.latitude,
      longitude: message.location.longitude,
    };
    return result;
  }

  // Contact — normalize to match mediaProcessor's contacts format
  if (message.contact) {
    result.mediaType = 'contacts';
    result.raw = {
      contacts: [{
        name: { formatted_name: [message.contact.first_name, message.contact.last_name].filter(Boolean).join(' ') },
        phones: [{ phone: message.contact.phone_number }],
      }],
    };
    return result;
  }

  // Unsupported
  result.text = '[Unsupported Telegram message type]';
  return result;
}
