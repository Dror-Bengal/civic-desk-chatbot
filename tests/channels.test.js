import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { randomUUID, createHmac } from 'node:crypto';
import { once } from 'node:events';
import { setTimeout as wait } from 'node:timers/promises';
import express from 'express';
import mongoose from 'mongoose';
import { createApp } from '../app.js';
import { telegramPoller } from '../channels/providers.js';
import { User } from '../models/User.js';
import { Message } from '../models/Message.js';
import { brief, getResponse } from '../core/llmCore.js';

let http, provider, appUrl, providerUrl, poller;
const options = {phoneId: 'demo-line', verifyToken: 'local-verify', secret: randomUUID(), token: 'local-only'};
const waSent = [], tgSent = [], offsets = [];
let failNextSend = false;
const tgUpdate = {update_id: 42, message: {chat: {id: 17, type: 'private'}, from: {id: 17}, text: 'Is the meeting accessible?'}};

async function serve(app) {
  const server = app.listen(0,'127.0.0.1');
  await once(server, 'listening');
  return [server, 'http://127.0.0.1:' + server.address().port];
}
async function close(server) {
  if (!server) return;
  server.closeAllConnections();
  await new Promise(resolve => server.close(resolve));
}

before(async () => {
  process.env.REPLY_MODE = 'local';
  await mongoose.connect(process.env.MONGODB_URI, {dbName: 'channel_test_' + randomUUID().replaceAll('-','')});
  const local = express(); local.use(express.json());
  local.post('/demo-line/messages', (req,res) => {
    assert.equal(req.get('Authorization'), 'Bearer local-only');
    if (failNextSend) { failNextSend = false; return res.sendStatus(503); }
    waSent.push(req.body); res.json({messages:[{id:'local-delivery'}]});
  });
  local.post('/botlocal/getUpdates', async (req,res) => {
    offsets.push(req.body.offset);
    await wait(10);
    res.json({ok:true, result: req.body.offset <= 42 ? [tgUpdate] : []});
  });
  local.post('/botlocal/sendMessage', (req,res) => { tgSent.push(req.body); res.json({ok:true}); });
  [provider, providerUrl] = await serve(local);
  [http, appUrl] = await serve(createApp({...options, base:providerUrl}));
});
after(async () => {
  poller?.stop();
  await close(http); await close(provider);
  if (mongoose.connection.readyState) {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  }
});

test('web renders the original chat, remembers the thread and isolates browser sessions', async () => {
  const home = await fetch(appUrl);
  const cookie = home.headers.get('set-cookie').split(';')[0];
  assert.match(await home.text(), /id="message-input"/);
  async function ask(message) {
    return fetch(appUrl+'/api/chat',{method:'POST',headers:{cookie,'Content-Type':'application/json'},body:JSON.stringify({message})});
  }
  assert.equal((await (await ask('When is the next open meeting?')).json()).response, brief.meeting);
  assert.equal((await (await ask('Where is it?')).json()).response, brief.meeting);
  const history = await (await fetch(appUrl+'/api/history',{headers:{cookie}})).json();
  assert.equal(history.length,4);
  assert.deepEqual(await (await fetch(appUrl+'/api/history')).json(),[]);
  assert.equal((await ask('   ')).status,400);
  await User.updateOne({channelType:'web',channelId:cookie.slice('sessionId='.length)},{$set:{isBlocked:true}});
  assert.equal((await ask('Office hours?')).status,403);
});

function postWebhook(body) {
  const json = JSON.stringify(body);
  const signature = createHmac('sha256',options.secret).update(json).digest('hex');
  return fetch(appUrl+'/webhook/whatsapp',{method:'POST',headers:{
    'Content-Type':'application/json','x-hub-signature-256':'sha256='+signature,
  },body:json});
}
test('WhatsApp verifies the webhook, handles a delivery retry and acknowledges a replay', async () => {
  const challenge=await fetch(appUrl+'/webhook/whatsapp?hub.mode=subscribe&hub.verify_token=local-verify&hub.challenge=sample');
  assert.equal(await challenge.text(),'sample');
  const event={object:'whatsapp_business_account',entry:[{changes:[{field:'messages',value:{
    metadata:{phone_number_id:'demo-line'},messages:[{id:'sample-wa-1',from:'demo-sender',type:'text',text:{body:'When is the next meeting?'}}],
  }}]}]};
  failNextSend=true;
  assert.equal((await postWebhook(event)).status,503);
  assert.equal((await postWebhook(event)).status,200);
  assert.equal((await postWebhook(event)).status,200);
  assert.equal(waSent.length,1);
  assert.equal(waSent[0].to,'demo-sender');
  assert.equal(waSent[0].text.body,brief.meeting);
  assert.equal(await Message.countDocuments({channelType:'whatsapp'}),2);
});

test('Telegram polls, replies to a private message and resumes at the saved offset', async () => {
  for (let run=0;run<2;run++) {
    const previous=offsets.length;
    poller=telegramPoller({base:providerUrl,token:'local'});
    const running=poller.run();
    try {
      for (let i=0;i<150 && !offsets.slice(previous).includes(43);i++) await wait(20);
      assert.ok(offsets.slice(previous).includes(43));
      if (run===1) assert.equal(offsets[previous],43);
    } finally {poller.stop();await running;}
  }
  assert.deepEqual(tgSent,[{chat_id:'17',text:brief.access}]);
  assert.equal(await Message.countDocuments({channelType:'telegram'}),2);
});

test('optional model adapter reads prior turns and returns the provider reply', async () => {
  const originalFetch=globalThis.fetch;
  process.env.REPLY_MODE='gemini';
  try {
    globalThis.fetch=async (url, options) => {
      const content=JSON.parse(options.body).contents;
      assert.equal(content[0].role,'model');
      assert.equal(content[1].parts[0].text,'Is the room accessible?');
      return Response.json({candidates:[{content:{parts:[{text:'A sample provider reply.'}]}}]});
    };
    const answer=await getResponse({userMessage:'Is the room accessible?',chatHistory:[{role:'assistant',content:brief.meeting}]});
    assert.equal(answer.text,'A sample provider reply.');
  } finally {globalThis.fetch=originalFetch;process.env.REPLY_MODE='local';}
});
