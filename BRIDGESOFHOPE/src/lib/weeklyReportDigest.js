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

const DAILY_DRAFT_SYSTEM_PROMPT =
  'You help a nurse/program staffer draft their weekly patient report from the daily notes they already ' +
  'wrote this week. Write a plain-language draft summary, 3-6 sentences, covering only what the daily notes ' +
  'actually say — do not invent facts, and do not assume every day of the week happened if it is not present. ' +
  'This is a DRAFT for a human to review and edit before submitting, not a final report. ' +
  'Return ONLY valid JSON with one key: "draft" (the narrative string).';

function formatDailyReportLine(row) {
  const parts = [`${row.report_date}:`];
  const push = (label, value) => {
    const v = value == null ? '' : String(value).trim();
    if (v) parts.push(`${label} - ${v}`);
  };
  push('Observations', row.observations);
  push('Assessment', row.assessment);
  push('Follow-up', row.follow_up);
  push('Notes', row.notes);
  return parts.join(' ');
}

/**
 * Drafts a weekly-report narrative from only the daily reports that actually exist for that
 * week (partial weeks are expected — no day is assumed). The nurse/program staffer reviews
 * and edits the draft before saving; nothing is submitted automatically.
 * @param {string} patientName
 * @param {number|string} weekNumber
 * @param {Array<{report_date: string, observations?: string, assessment?: string, follow_up?: string, notes?: string}>} dailyReportRows
 * @returns {Promise<string>}
 */
export async function draftWeeklyReportFromDailyReports(patientName, weekNumber, dailyReportRows) {
  const rows = (dailyReportRows || [])
    .filter((r) => r && r.report_date)
    .sort((a, b) => String(a.report_date).localeCompare(String(b.report_date)));
  if (rows.length === 0) {
    throw new Error('No daily reports logged for this week yet — add at least one before drafting a summary.');
  }
  const body = rows.map(formatDailyReportLine).join('\n');
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${groqApiKey()}`,
    },
    body: JSON.stringify({
      model: textModel(),
      temperature: 0.2,
      max_tokens: 400,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: DAILY_DRAFT_SYSTEM_PROMPT },
        {
          role: 'user',
          content: `Resident: ${patientName || 'Unknown'}\nWeek ${weekNumber}\nDaily notes logged (${rows.length} of 7 days):\n${body}`,
        },
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
    throw new Error('No draft returned from Groq.');
  }
  const text = String(content || '').trim();
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  const payload = jsonMatch ? jsonMatch[0] : text;
  let parsed;
  try {
    parsed = JSON.parse(payload);
  } catch {
    throw new Error('Groq returned an unreadable draft. Try again.');
  }
  const draft = String(parsed.draft || '').trim();
  if (!draft) throw new Error('Groq did not return a draft. Try again.');
  return draft;
}
