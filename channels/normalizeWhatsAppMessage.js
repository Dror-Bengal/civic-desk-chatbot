export function normalizeWhatsAppMessage(message, messageType) {
  const result = {
    text: null,
    mediaType: null,
    mediaId: null,
    mediaUrl: null,
    mediaMime: null,
    raw: message,
  };

  switch (messageType) {
    case 'text':
      result.text = message.text?.body || '';
      break;

    case 'audio':
      result.mediaType = 'audio';
      result.mediaId = message.audio?.id;
      result.mediaMime = message.audio?.mime_type;
      break;

    case 'image':
      result.mediaType = 'image';
      result.mediaId = message.image?.id;
      result.mediaMime = message.image?.mime_type;
      result.text = message.image?.caption || null;
      break;

    case 'video':
      result.mediaType = 'video';
      result.mediaId = message.video?.id;
      result.mediaMime = message.video?.mime_type;
      result.text = message.video?.caption || null;
      break;

    case 'document':
      result.mediaType = 'document';
      result.mediaId = message.document?.id;
      result.mediaMime = message.document?.mime_type;
      result.text = message.document?.caption || null;
      break;

    case 'sticker':
      result.mediaType = 'sticker';
      result.mediaId = message.sticker?.id;
      result.mediaMime = message.sticker?.mime_type || 'image/webp';
      break;

    case 'location':
      result.mediaType = 'location';
      result.raw = {
        latitude: message.location?.latitude,
        longitude: message.location?.longitude,
        name: message.location?.name,
        address: message.location?.address,
      };
      break;

    case 'contacts':
      result.mediaType = 'contacts';
      result.raw = {
        contacts: message.contacts || [],
      };
      break;

    case 'button':
      // Button reply
      result.text = message.button?.text || '';
      break;

    case 'interactive':
      // Interactive message reply (list/button)
      if (message.interactive?.type === 'button_reply') {
        result.text = message.interactive.button_reply?.title || '';
      } else if (message.interactive?.type === 'list_reply') {
        result.text = message.interactive.list_reply?.title || '';
      }
      break;

    default:
      console.log(`Unsupported WhatsApp message type: ${messageType}`);
      result.text = `[Unsupported message type: ${messageType}]`;
  }

  return result;
}
