import { createHmac, timingSafeEqual } from 'node:crypto';
import mongoose from 'mongoose';
import { receive } from '../core/inbox.js';
import { normalizeWhatsAppMessage } from './normalizeWhatsAppMessage.js';
import { normalizeTelegramMessage } from './normalizeTelegramMessage.js';

async function providerPost(url, payload, headers = {}) {
  const response = await fetch(url, {
    method: 'POST', headers: {'Content-Type': 'application/json', ...headers},
    body: JSON.stringify(payload), signal: AbortSignal.timeout(40000),
  });
  if (!response.ok) throw Error('Messaging provider failed (' + response.status + ')');
  return response.json();
}

export function mountWhatsApp(app, options) {
  const path = '/webhook/whatsapp';
  app.get(path, (req, res) => {
    if (req.query['hub.mode'] !== 'subscribe' || req.query['hub.verify_token'] !== options.verifyToken ||
        typeof req.query['hub.challenge'] !== 'string') return res.sendStatus(403);
    res.type('text').send(req.query['hub.challenge']);
  });
  app.post(path, async (req, res) => {
    const expected = createHmac('sha256', options.secret).update(req.rawBody || '').digest();
    const signature = req.get('x-hub-signature-256') || '';
    if (!/^sha256=[a-f\d]{64}$/i.test(signature) ||
        !timingSafeEqual(expected, Buffer.from(signature.slice(7), 'hex'))) return res.sendStatus(403);
    try {
      if (req.body.object === 'whatsapp_business_account') {
        for (const entry of req.body.entry || []) {
          for (const change of entry.changes || []) {
            const value = change.value;
            if (change.field !== 'messages' || value?.metadata?.phone_number_id !== options.phoneId) continue;
            for (const msg of value.messages || []) {
              if (!msg.id || !msg.from) continue;
              const normalized = normalizeWhatsAppMessage(msg, msg.type);
              await receive('whatsapp', String(msg.from), msg.id, normalized, reply =>
                providerPost(options.base + '/' + encodeURIComponent(options.phoneId) + '/messages', {
                  messaging_product: 'whatsapp', to: msg.from, type: 'text', text: {body: reply.slice(0,4096)},
                }, {Authorization: 'Bearer ' + options.token}));
            }
          }
        }
      }
      res.sendStatus(200);
    } catch { res.sendStatus(503); }
  });
}

export function telegramPoller({base, token}) {
  let stopped = false;
  const url = base + '/bot' + token;
  const state = mongoose.connection.collection('channel_state');
  const cursorKey = 'telegram:' + token.split(':')[0];
  return {
    stop() { stopped = true; },
    async run() {
      let offset = (await state.findOne({_id: cursorKey}))?.offset || 0;
      while (!stopped) {
        try {
          const result = await providerPost(url + '/getUpdates', {offset, timeout: 25, allowed_updates: ['message']});
          if (!result.ok || !Array.isArray(result.result)) throw Error('Polling failed');
          for (const update of result.result) {
            if (update.update_id < offset) continue;
            const msg = update.message;
            if (msg?.chat?.type === 'private' && !msg.from?.is_bot) {
              const peer = String(msg.chat.id);
              await receive('telegram', peer, String(update.update_id), normalizeTelegramMessage(msg), async reply => {
                const receipt = await providerPost(url + '/sendMessage', {chat_id: peer, text: reply.slice(0,4096)});
                if (!receipt.ok) throw Error('Message was not accepted');
              });
            }
            offset = update.update_id + 1;
            await state.updateOne({_id: cursorKey}, {$set: {offset}}, {upsert: true});
          }
        } catch {
          if (!stopped) await new Promise(resolve => setTimeout(resolve, 1500));
        }
      }
    },
  };
}
