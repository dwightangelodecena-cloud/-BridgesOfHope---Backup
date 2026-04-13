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
  if (p === 'anthropic' || p === 'claude') return 'anthropic';
  if (p === 'openai') return 'openai';
  if (import.meta.env.VITE_ANTHROPIC_API_KEY?.trim()) return 'anthropic';
  if (import.meta.env.VITE_OPENAI_API_KEY?.trim()) return 'openai';
  return null;
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
        '• VITE_OPENAI_API_KEY=sk-...  (OpenAI)',
        '• or VITE_ANTHROPIC_API_KEY=sk-ant-...  (Anthropic)',
        'Optional: VITE_AI_WEEKLY_REPORT_PROVIDER=openai or anthropic',
        '',
        'CapstoneMobile/.env is separate — keys must be in BRIDGESOFHOPE/.env for this screen.',
      ].join('\n')
    );
  }
  const prompt = `${patientSummary}\n\n--- Weekly report slot ---\n${weekBlock}\n\nProvide actionable recommendations for the care team.`;
  if (provider === 'anthropic') return anthropicComplete(prompt);
  return openAiComplete(prompt);
}
