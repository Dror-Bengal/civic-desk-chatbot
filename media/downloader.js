import client from 'axios';
const axios = client.create({timeout: 25000, maxContentLength: 16 * 1024 * 1024});
import { config } from '../config/env.js';

const WHATSAPP_API = `https://graph.facebook.com/${config.whatsappApiVersion}`;

/**
 * Download media from WhatsApp API
 * WhatsApp media requires a 2-step process:
 * 1. Get the media URL using the media ID
 * 2. Download the actual media from the URL
 */
export async function downloadWhatsAppMedia(mediaId) {
  try {
    // Step 1: Get media URL from WhatsApp API
    const urlResponse = await axios.get(
      `${WHATSAPP_API}/${mediaId}`,
      {
        headers: {
          Authorization: `Bearer ${config.whatsappAccessToken}`
        }
      }
    );

    const mediaUrl = urlResponse.data.url;
    const mimeType = urlResponse.data.mime_type;

    // Step 2: Download actual media from the URL
    const mediaResponse = await axios.get(mediaUrl, {
      headers: {
        Authorization: `Bearer ${config.whatsappAccessToken}`
      },
      responseType: 'arraybuffer'
    });

    return {
      buffer: Buffer.from(mediaResponse.data),
      mimeType: mimeType || 'application/octet-stream',
      size: mediaResponse.data.byteLength
    };
  } catch (error) {
    throw new Error('Provider attachment could not be downloaded.');
  }
}

/**
 * Download media from Telegram API
 * Telegram media requires a 2-step process:
 * 1. Get the file path using the file_id via getFile
 * 2. Download the actual file from Telegram's file server
 */
export async function downloadTelegramMedia(fileId) {
  const botToken = config.telegramBotToken;
  const TELEGRAM_API = `https://api.telegram.org/bot${botToken}`;

  try {
    // Step 1: Get file path from Telegram API
    const fileResponse = await axios.get(`${TELEGRAM_API}/getFile`, {
      params: { file_id: fileId },
    });

    const filePath = fileResponse.data.result.file_path;

    // Step 2: Download actual file
    const mediaResponse = await axios.get(
      `https://api.telegram.org/file/bot${botToken}/${filePath}`,
      { responseType: 'arraybuffer' }
    );

    const mimeType = mediaResponse.headers['content-type'] || 'application/octet-stream';

    return {
      buffer: Buffer.from(mediaResponse.data),
      mimeType,
      size: mediaResponse.data.byteLength,
    };
  } catch (error) {
    throw new Error('Provider attachment could not be downloaded.');
  }
}
