import express from 'express';
import cookieParser from 'cookie-parser';
import { randomUUID } from 'node:crypto';
import { brief } from './core/llmCore.js';
import { handleMessage } from './core/orchestrator.js';
import { loadChatHistory } from './core/memoryManager.js';
import { inOrder } from './core/inbox.js';
import { User } from './models/User.js';
import { Conversation } from './models/Conversation.js';
import { mountWhatsApp } from './channels/providers.js';

export function createApp(whatsapp) {
  const app = express();
  app.disable('x-powered-by');
  app.set('view engine', 'ejs');
  app.use(express.static('public'));
  app.use(cookieParser());
  app.use(express.json({limit: '1mb', verify(req, res, raw) {
    if (req.path === '/webhook/whatsapp') req.rawBody = raw;
  }}));
  if (whatsapp) mountWhatsApp(app, whatsapp);
  function session(req, res) {
    const current = req.cookies.sessionId;
    if (typeof current === 'string' && /^[a-f0-9-]{36}$/.test(current)) return current;
    const id = randomUUID();
    res.cookie('sessionId', id, {httpOnly: true, sameSite: 'lax', maxAge: 30 * 86400000,
      secure: process.env.COOKIE_SECURE === 'true'});
    return id;
  }
  app.get(['/', '/chat'], (req, res) => {
    session(req, res);
    res.set('Cache-Control','no-store').render('chat', {welcomeMessage: brief.welcome});
  });
  app.get('/api/history', async (req, res, next) => {
    try {
      const user = await User.findOne({channelType: 'web', channelId: session(req, res)});
      const convo = user && await Conversation.findOne({userId: user._id, status: 'active'});
      res.set('Cache-Control','no-store').json(convo ? await loadChatHistory(convo._id) : []);
    } catch (err) { next(err); }
  });
  app.post('/api/chat', async (req, res, next) => {
    try {
      const text = req.body?.message;
      if (typeof text !== 'string' || !text.trim() || text.length > 10000)
        return res.status(400).json({error: 'Enter a message of up to 10,000 characters.'});
      const id = session(req, res);
      const result = await inOrder('web:' + id, () => handleMessage({channelType:'web', channelId:id, text:text.trim()}));
      if (result.shouldRespond === false) return res.status(403).json({error: 'This conversation is closed.'});
      if (!result.success) return res.status(503).json({error: 'The information desk could not answer. Please try again.'});
      res.json({response: result.response, conversationId: result.conversationId});
    } catch (err) { next(err); }
  });
  app.use((err, req, res, next) => { res.status(err.status || 500).json({error: 'Request could not be completed.'}); });
  return app;
}
