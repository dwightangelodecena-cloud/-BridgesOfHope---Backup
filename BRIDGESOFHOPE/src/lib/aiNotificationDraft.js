// Same Groq call pattern as hospitalReferralScan.js (client-side, text-only here — no vision model needed).

function groqApiKey() {
  const key = import.meta.env.VITE_GROQ_API_KEY?.trim();
  if (!key) {
    throw new Error(
      'Groq API is not set up. Add VITE_GROQ_API_KEY to BRIDGESOFHOPE/.env and restart the dev server.'
    );
  }
  return key;
}

function textModel() {
  return import.meta.env.VITE_GROQ_REFERRAL_TEXT_MODEL?.trim() || 'llama-3.3-70b-versatile';
}

const CATEGORY_TONE = {
  promo: 'an upbeat, inviting announcement about a program, event, or service',
  clinical: 'a calm, clear, and reassuring clinical concern notice — serious in content but not alarming in tone',
  progress: 'a warm, encouraging progress update about a resident\'s recovery',
  general: 'a clear, friendly general announcement',
};

const SYSTEM_PROMPT =
  'You draft short push-style notifications sent from a residential rehabilitation facility (Bridges of Hope / Kalinga) to residents\' guardians/families. ' +
  'Return ONLY valid JSON with exactly two keys: "title" (5-8 words, no ending punctuation) and "body" (1-3 sentences, warm and plain-language, no medical jargon, no markdown). ' +
  'Never invent specific names, dates, or facts that were not given to you — keep it general if specifics are missing.';

function parseDraftJson(raw) {
  const text = String(raw || '').trim();
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  const payload = jsonMatch ? jsonMatch[0] : text;
  let parsed;
  try {
    parsed = JSON.parse(payload);
  } catch {
    throw new Error('Groq returned an unreadable draft. Try again.');
  }
  const title = String(parsed.title || '').trim();
  const body = String(parsed.body || '').trim();
  if (!title || !body) {
    throw new Error('Groq did not return both a title and a message. Try again.');
  }
  return { title, body };
}

async function groqChat(messages) {
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${groqApiKey()}`,
    },
    body: JSON.stringify({
      model: textModel(),
      temperature: 0.4,
      max_tokens: 400,
      response_format: { type: 'json_object' },
      messages,
    }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = json?.error?.message || res.statusText || 'Groq request failed';
    throw new Error(msg);
  }
  const content = json?.choices?.[0]?.message?.content;
  if (!content || typeof content !== 'string') {
    throw new Error('No draft returned from Groq.');
  }
  return content;
}

/**
 * Draft (empty hint) or polish (existing title/body passed as hint) a notification.
 * @param {{ category: string, hint: string }} params
 * @returns {Promise<{ title: string, body: string }>}
 */
export async function draftNotificationWithAi({ category, hint }) {
  const tone = CATEGORY_TONE[category] || CATEGORY_TONE.general;
  const trimmedHint = String(hint || '').trim();
  const userPrompt = trimmedHint
    ? `Write ${tone}. Base it on this draft/instructions from the admin — improve clarity and tone, keep the same meaning, do not add new facts:\n\n${trimmedHint}`
    : `Write ${tone}. No specific details were given, so keep it general and inviting.`;
  const content = await groqChat([
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: userPrompt },
  ]);
  return parseDraftJson(content);
}
