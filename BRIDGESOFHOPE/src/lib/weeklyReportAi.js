/**
 * Client-side calls to OpenAI or Anthropic for weekly-report care suggestions.
 * For production, prefer a backend proxy so API keys are not bundled in the browser.
 */

const SYSTEM =
  'You are a supportive clinical documentation assistant for a substance-use and mental-health residential care context (Bridges of Hope / Kalinga). ' +
  'Given structured weekly report metadata and patient context, produce concise, practical recommendations for the care team and family: next clinical or therapeutic steps, monitoring points, engagement ideas, and safety or follow-up considerations when appropriate. ' +
  'Use clear bullet points. Do not diagnose. Do not prescribe medications. If data is missing, say what would help and give general best-practice guidance only. ' +
  'Keep the tone professional and compassionate.';

function pickProvider() {
  const p = (import.meta.env.VITE_AI_WEEKLY_REPORT_PROVIDER || '').toLowerCase().trim();
  if (p === 'groq') return 'groq';
  if (p === 'gemini' || p === 'google') return 'gemini';
  if (p === 'anthropic' || p === 'claude') return 'anthropic';
  if (p === 'openai') return 'openai';
  if (import.meta.env.VITE_GROQ_API_KEY?.trim()) return 'groq';
  if (import.meta.env.VITE_GEMINI_API_KEY?.trim()) return 'gemini';
  if (import.meta.env.VITE_ANTHROPIC_API_KEY?.trim()) return 'anthropic';
  if (import.meta.env.VITE_OPENAI_API_KEY?.trim()) return 'openai';
  return null;
}

async function geminiComplete(prompt) {
  const key = import.meta.env.VITE_GEMINI_API_KEY?.trim();
  if (!key) throw new Error('Missing VITE_GEMINI_API_KEY.');
  const configuredModel = import.meta.env.VITE_GEMINI_WEEKLY_REPORT_MODEL?.trim() || 'gemini-2.0-flash';
  const normalizedConfiguredModel =
    configuredModel === 'gemini-1.5-flash' ? 'gemini-1.5-flash-latest' : configuredModel;
  const candidateModels = Array.from(
    new Set([
      normalizedConfiguredModel,
      'gemini-2.0-flash',
      'gemini-2.0-flash-lite',
      'gemini-1.5-flash',
    ])
  );

  let lastError = 'Gemini request failed';
  for (const model of candidateModels) {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          generationConfig: {
            temperature: 0.35,
            maxOutputTokens: 1200,
          },
          contents: [
            {
              role: 'user',
              parts: [{ text: `${SYSTEM}\n\n${prompt}` }],
            },
          ],
        }),
      }
    );
    const json = await res.json().catch(() => ({}));
    if (res.ok) {
      const text =
        json?.candidates?.[0]?.content?.parts
          ?.map((p) => p?.text)
          .filter((t) => typeof t === 'string' && t.trim())
          .join('\n')
          .trim() || '';
      if (!text) throw new Error('No text in Gemini response.');
      return text;
    }
    const msg = json?.error?.message || res.statusText || 'Gemini request failed';
    lastError = `Model "${model}": ${msg}`;
    const modelNotFound = res.status === 404 || /not found|unsupported|listmodels/i.test(msg);
    if (!modelNotFound) break;
  }
  throw new Error(lastError);
}

async function openAiComplete(prompt) {
  const key = import.meta.env.VITE_OPENAI_API_KEY?.trim();
  if (!key) throw new Error('Missing VITE_OPENAI_API_KEY.');
  const model = import.meta.env.VITE_OPENAI_WEEKLY_REPORT_MODEL?.trim() || 'gpt-4o-mini';
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.35,
      max_tokens: 1200,
      messages: [
        { role: 'system', content: SYSTEM },
        { role: 'user', content: prompt },
      ],
    }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = json?.error?.message || res.statusText || 'OpenAI request failed';
    throw new Error(msg);
  }
  const text = json?.choices?.[0]?.message?.content;
  if (!text || typeof text !== 'string') throw new Error('No text in OpenAI response.');
  return text.trim();
}

async function groqComplete(prompt) {
  const key = import.meta.env.VITE_GROQ_API_KEY?.trim();
  if (!key) throw new Error('Missing VITE_GROQ_API_KEY.');
  const model = import.meta.env.VITE_GROQ_WEEKLY_REPORT_MODEL?.trim() || 'llama-3.1-8b-instant';
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.35,
      max_tokens: 1200,
      messages: [
        { role: 'system', content: SYSTEM },
        { role: 'user', content: prompt },
      ],
    }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = json?.error?.message || res.statusText || 'Groq request failed';
    throw new Error(msg);
  }
  const text = json?.choices?.[0]?.message?.content;
  if (!text || typeof text !== 'string') throw new Error('No text in Groq response.');
  return text.trim();
}

async function anthropicComplete(prompt) {
  const key = import.meta.env.VITE_ANTHROPIC_API_KEY?.trim();
  if (!key) throw new Error('Missing VITE_ANTHROPIC_API_KEY.');
  const model =
    import.meta.env.VITE_ANTHROPIC_WEEKLY_REPORT_MODEL?.trim() || 'claude-3-5-haiku-20241022';
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: 1200,
      system: SYSTEM,
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = json?.error?.message || res.statusText || 'Anthropic request failed';
    throw new Error(msg);
  }
  const block = json?.content?.find((b) => b.type === 'text');
  const text = block?.text;
  if (!text || typeof text !== 'string') throw new Error('No text in Anthropic response.');
  return text.trim();
}

/**
 * @param {{ patientSummary: string, weekBlock: string }} params
 * @returns {Promise<string>}
 */
export async function fetchWeeklyReportRecommendation({ patientSummary, weekBlock }) {
  const provider = pickProvider();
  if (!provider) {
    throw new Error(
      [
        'AI recommendations are not set up for this app yet.',
        '',
        'Add a key to the web project env file (folder BRIDGESOFHOPE, next to package.json), then restart the dev server:',
        '• VITE_GROQ_API_KEY=gsk_...  (Groq)',
        '• VITE_GEMINI_API_KEY=AIza...  (Gemini)',
        '• VITE_OPENAI_API_KEY=sk-...  (OpenAI)',
        '• or VITE_ANTHROPIC_API_KEY=sk-ant-...  (Anthropic)',
        'Optional: VITE_AI_WEEKLY_REPORT_PROVIDER=groq, gemini, openai, or anthropic',
        '',
        'CapstoneMobile/.env is separate — keys must be in BRIDGESOFHOPE/.env for this screen.',
      ].join('\n')
    );
  }
  const prompt = `${patientSummary}\n\n--- Weekly report slot ---\n${weekBlock}\n\nProvide actionable recommendations for the care team.`;
  try {
    if (provider === 'groq') return await groqComplete(prompt);
    if (provider === 'gemini') return await geminiComplete(prompt);
    if (provider === 'anthropic') return await anthropicComplete(prompt);
    return await openAiComplete(prompt);
  } catch (err) {
    const base = err instanceof Error ? err.message : 'AI request failed.';
    const configured = (import.meta.env.VITE_AI_WEEKLY_REPORT_PROVIDER || '').trim() || 'not-set';
    const hasGeminiKey = Boolean(import.meta.env.VITE_GEMINI_API_KEY?.trim());
    const hasGroqKey = Boolean(import.meta.env.VITE_GROQ_API_KEY?.trim());
    const hasOpenAiKey = Boolean(import.meta.env.VITE_OPENAI_API_KEY?.trim());
    const hasAnthropicKey = Boolean(import.meta.env.VITE_ANTHROPIC_API_KEY?.trim());
    throw new Error(
      `Provider selected: ${provider} (env: ${configured}, hasGroqKey: ${hasGroqKey}, hasGeminiKey: ${hasGeminiKey}, hasOpenAiKey: ${hasOpenAiKey}, hasAnthropicKey: ${hasAnthropicKey}). ${base}`
    );
  }
}
