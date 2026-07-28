// Same Groq call pattern as hospitalReferralScan.js / aiNotificationDraft.js — client-side, text-only.

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

const SYSTEM_PROMPT =
  'You summarize a residential rehabilitation patient\'s weekly nurse/program reports for admin review. ' +
  'Write a plain-language progress narrative, 3-5 sentences, covering the overall trend (improving/stable/declining), ' +
  'anything clinically notable (vitals, medications, behavior), and any recommendations worth flagging. ' +
  'Do not invent facts not present in the reports. Return ONLY valid JSON with one key: "digest" (the narrative string).';

function formatWeekBlock(row) {
  const lines = [`Week ${row.week_number} (${row.report_date || row.submitted_at || 'undated'}):`];
  const push = (label, value) => {
    const v = value == null ? '' : String(value).trim();
    if (v) lines.push(`- ${label}: ${v}`);
  };
  push('Progress', row.progress_percent != null ? `${row.progress_percent}%` : '');
  push('Vitals', [row.vitals_bp && `BP ${row.vitals_bp}`, row.vitals_temperature && `Temp ${row.vitals_temperature}`, row.vitals_spo2 && `SpO2 ${row.vitals_spo2}`]
    .filter(Boolean)
    .join(', '));
  push('Nurse note', row.nurse_note || row.notes);
  push('Behavior observation', row.behavior_observation);
  push('Current medications', row.current_medications);
  push('Medication intervention', row.medication_intervention);
  push('Ongoing medical concern', row.ongoing_medical_concern);
  push('Recommendations', row.recommendations);
  push('Summary', row.summary);
  return lines.join('\n');
}

function parseDigestJson(raw) {
  const text = String(raw || '').trim();
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  const payload = jsonMatch ? jsonMatch[0] : text;
  let parsed;
  try {
    parsed = JSON.parse(payload);
  } catch {
    throw new Error('Groq returned an unreadable summary. Try again.');
  }
  const digest = String(parsed.digest || '').trim();
  if (!digest) throw new Error('Groq did not return a summary. Try again.');
  return digest;
}

/**
 * @param {string} patientName
 * @param {Record<number, object>} weeklyReportsByWeek keyed by week number
 * @returns {Promise<string>} short narrative
 */
export async function generateWeeklyReportDigest(patientName, weeklyReportsByWeek) {
  const rows = Object.values(weeklyReportsByWeek || {})
    .filter(Boolean)
    .sort((a, b) => (Number(a.week_number) || 0) - (Number(b.week_number) || 0));
  if (rows.length === 0) {
    throw new Error('No weekly reports available to summarize yet.');
  }
  const body = rows.map(formatWeekBlock).join('\n\n');
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${groqApiKey()}`,
    },
    body: JSON.stringify({
      model: textModel(),
      temperature: 0.2,
      max_tokens: 500,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: `Resident: ${patientName || 'Unknown'}\n\n${body}` },
      ],
    }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = json?.error?.message || res.statusText || 'Groq request failed';
    throw new Error(msg);
  }
  const content = json?.choices?.[0]?.message?.content;
  if (!content || typeof content !== 'string') {
    throw new Error('No summary returned from Groq.');
  }
  return parseDigestJson(content);
}
