import { readFileSync } from 'node:fs';

export const brief = JSON.parse(readFileSync(new URL('../config/brief.json', import.meta.url)));
const fallback = 'I can help with the open meeting, accessibility, registration and office hours. Which would you like to know about?';

function localAnswer(text, history, attachment) {
  if (attachment) return 'This local demo answers written questions. Please type your question about the meeting or the office.';
  if (/wheelchair|step.free|accessib|stairs|entrance/i.test(text)) return brief.access;
  if (/register|registration|book|sign up/i.test(text)) return brief.registration;
  if (/office|desk|weekday|working hours/i.test(text)) return brief.hours;
  if (/meeting|assembly|event/i.test(text)) return brief.meeting;
  if (/when|where|what time|what day/i.test(text)) {
    const lastAnswer = history.findLast(item => item.role === 'assistant')?.content;
    if (lastAnswer === brief.hours) return brief.hours;
    if ([brief.meeting, brief.access, brief.registration].includes(lastAnswer)) return brief.meeting;
  }
  return fallback;
}

function toPart(item) {
  if (item.type === 'text') return {text: item.text};
  if (item.type === 'media') return {inlineData: {mimeType: item.mimeType, data: item.data}};
  const match = /^data:([^;]+);base64,(.+)$/.exec(item.image_url.url);
  if (!match) throw Error('Unsupported media');
  return {inlineData: {mimeType: match[1], data: match[2]}};
}

export async function getResponse({userMessage, chatHistory, multimodalContent}) {
  if (process.env.REPLY_MODE !== 'gemini') {
    return {text: localAnswer(userMessage || '', chatHistory, multimodalContent), metadata: {model: 'local-faq'}};
  }
  const model = process.env.GEMINI_MODEL;
  const history = chatHistory.map(({role, content}) => ({
    role: role === 'assistant' ? 'model' : 'user', parts: [{text: content}],
  }));
  const parts = multimodalContent ? multimodalContent.map(toPart) : [{text: userMessage}];
  const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/' +
    encodeURIComponent(model) + ':generateContent', {
    method: 'POST', headers: {'Content-Type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY},
    signal: AbortSignal.timeout(45000),
    body: JSON.stringify({
      systemInstruction: {parts: [{text: 'You are the public information desk. Answer factual questions using this office brief. Say when information is unavailable.\n' + JSON.stringify(brief)}]},
      contents: [...history, {role: 'user', parts}],
    }),
  });
  if (!response.ok) throw Error('Reply provider unavailable');
  const body = await response.json();
  const text = body.candidates?.[0]?.content?.parts?.filter(p => !p.thought).map(p => p.text || '').join('').trim();
  if (!text) throw Error('Reply provider returned no text');
  return {text, metadata: {model, tokensUsed: body.usageMetadata?.totalTokenCount}};
}
