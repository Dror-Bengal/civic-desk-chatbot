import mongoose from 'mongoose';
import { handleMessage } from './orchestrator.js';

const active = new Map();
export async function inOrder(key, run) {
  const next = (active.get(key) || Promise.resolve()).catch(() => {}).then(run);
  active.set(key, next);
  try { return await next; }
  finally { if (active.get(key) === next) active.delete(key); }
}

// Store the generated reply before contacting the sender API so delivery retries
// can reuse it without adding a second exchange to the conversation.
export function receive(channel, peer, id, message, send) {
  return inOrder(channel + ':' + peer, async () => {
    const inbox = mongoose.connection.collection('receipts');
    const key = JSON.stringify([channel, peer, id]);
    let receipt = await inbox.findOne({_id: key});
    if (receipt?.sent) return;
    if (!receipt) {
      const result = await handleMessage({...message, channelType: channel, channelId: peer});
      if (!result.success && result.shouldRespond !== false) throw Error('Could not process message');
      receipt = {_id: key, reply: result.response || '', createdAt: new Date(), sent: false};
      await inbox.insertOne(receipt);
    }
    if (receipt.reply) await send(receipt.reply);
    await inbox.updateOne({_id: key}, {$set: {sent: true}});
  });
}
