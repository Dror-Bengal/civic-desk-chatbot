import mongoose from 'mongoose';
import { createApp } from './app.js';
import { telegramPoller } from './channels/providers.js';
import { config } from './config/env.js';

function required(name) {
  if (!process.env[name]) throw new Error('Missing setting: ' + name);
  return process.env[name];
}

if (!['local','gemini'].includes(process.env.REPLY_MODE || 'local')) throw Error('Unknown REPLY_MODE');
if (process.env.REPLY_MODE === 'gemini') { required('GEMINI_API_KEY'); required('GEMINI_MODEL'); }
const whatsapp = process.env.WHATSAPP_ENABLED === 'true' ? {
  base: 'https://graph.facebook.com/' + config.whatsappApiVersion,
  token: required('WHATSAPP_ACCESS_TOKEN'), secret: required('WHATSAPP_APP_SECRET'),
  phoneId: required('WHATSAPP_PHONE_NUMBER_ID'), verifyToken: required('WHATSAPP_VERIFY_TOKEN'),
} : null;
const telegram = process.env.TELEGRAM_ENABLED === 'true' ? {
  base: 'https://api.telegram.org', token: required('TELEGRAM_BOT_TOKEN'),
} : null;
await mongoose.connect(required('MONGODB_URI'));
await mongoose.connection.collection('receipts').createIndex({createdAt: 1}, {expireAfterSeconds: 7*86400});
createApp(whatsapp).listen(3000, '0.0.0.0', () => console.log('Civic Desk is ready.'));
if (telegram) telegramPoller(telegram).run().catch(() => { console.error('Polling stopped.'); process.exit(1); });
