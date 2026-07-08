import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

GlobalWorkerOptions.workerSrc = pdfWorker;

export const REFERRAL_SUMMARY_FIELDS = [
  { key: 'patientName', label: 'Patient Name' },
  { key: 'age', label: 'Age' },
  { key: 'sex', label: 'Sex' },
  { key: 'referringHospital', label: 'Referring Hospital' },
  { key: 'referringPhysician', label: 'Referring Physician' },
  { key: 'primaryDiagnosis', label: 'Primary Diagnosis' },
  { key: 'secondaryDiagnosis', label: 'Secondary Diagnosis' },
  { key: 'lastDrugUse', label: 'Last Drug Use' },
  { key: 'medicalClearance', label: 'Medical Clearance' },
  { key: 'currentMedications', label: 'Current Medications' },
  { key: 'reasonForReferral', label: 'Reason for Referral' },
  { key: 'riskAssessment', label: 'Risk Assessment' },
  { key: 'laboratoryResults', label: 'Laboratory Results' },
  { key: 'recommendation', label: 'Recommendation' },
];

const SYSTEM_PROMPT =
  'You extract structured data from hospital referral documents for a residential rehabilitation facility (Bridges of Hope / Kalinga). ' +
  'Return ONLY valid JSON with these keys: patientName, age, sex, referringHospital, referringPhysician, primaryDiagnosis, secondaryDiagnosis, lastDrugUse, medicalClearance, currentMedications, reasonForReferral, riskAssessment, laboratoryResults, recommendation, summary. ' +
  'Use null for missing fields. summary is a concise 2–4 sentence clinical overview for the admissions team. Do not diagnose beyond the document.';

function groqApiKey() {
  const key = import.meta.env.VITE_GROQ_API_KEY?.trim();
  if (!key) {
    throw new Error(
      'Groq API is not set up. Add VITE_GROQ_API_KEY to BRIDGESOFHOPE/.env and restart the dev server.'
    );
  }
  return key;
}

function visionModel() {
  return import.meta.env.VITE_GROQ_REFERRAL_SCAN_MODEL?.trim() || 'llama-3.2-11b-vision-preview';
}

function textModel() {
  return import.meta.env.VITE_GROQ_REFERRAL_TEXT_MODEL?.trim() || 'llama-3.3-70b-versatile';
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error(`Could not read ${file.name}.`));
    reader.readAsDataURL(file);
  });
}

async function extractPdfText(file) {
  const buffer = await file.arrayBuffer();
  const pdf = await getDocument({ data: buffer }).promise;
  const chunks = [];
  const pageLimit = Math.min(pdf.numPages, 6);
  for (let pageNum = 1; pageNum <= pageLimit; pageNum += 1) {
    const page = await pdf.getPage(pageNum);
    const content = await page.getTextContent();
    const text = content.items
      .map((item) => ('str' in item ? item.str : ''))
      .join(' ')
      .trim();
    if (text) chunks.push(text);
  }
  const joined = chunks.join('\n\n').trim();
  if (!joined) {
    throw new Error('No readable text found in this PDF. Try a clearer scan or an image file.');
  }
  return joined.slice(0, 12000);
}

export function parseReferralSummaryJson(raw) {
  const text = String(raw || '').trim();
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  const payload = jsonMatch ? jsonMatch[0] : text;
  let parsed;
  try {
    parsed = JSON.parse(payload);
  } catch {
    throw new Error('Groq returned an unreadable summary. Try again with a clearer file.');
  }
  const out = { summary: parsed.summary ?? null };
  for (const { key } of REFERRAL_SUMMARY_FIELDS) {
    const value = parsed[key];
    out[key] = value == null || value === '' ? null : String(value);
  }
  return out;
}

async function groqChat({ messages, model }) {
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${groqApiKey()}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.1,
      max_tokens: 2200,
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
    throw new Error('No summary returned from Groq.');
  }
  return content;
}

function isImageFile(file) {
  return /^image\/(jpeg|jpg|png|webp|gif)$/i.test(file.type || '') || /\.(jpe?g|png|webp|gif)$/i.test(file.name || '');
}

function isPdfFile(file) {
  return file.type === 'application/pdf' || /\.pdf$/i.test(file.name || '');
}

/**
 * @param {File} file
 * @returns {Promise<Record<string, string | null>>}
 */
export async function scanHospitalReferralFromFile(file) {
  if (!file) throw new Error('Choose a referral file to scan.');

  if (isImageFile(file)) {
    const dataUrl = await fileToDataUrl(file);
    const content = await groqChat({
      model: visionModel(),
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Extract all referral fields from this hospital referral document image. Return JSON only.' },
            { type: 'image_url', image_url: { url: dataUrl } },
          ],
        },
      ],
    });
    return parseReferralSummaryJson(content);
  }

  if (isPdfFile(file)) {
    const extracted = await extractPdfText(file);
    const content = await groqChat({
      model: textModel(),
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: `Extract all referral fields from this hospital referral document text:\n\n${extracted}`,
        },
      ],
    });
    return parseReferralSummaryJson(content);
  }

  throw new Error('Unsupported file type. Use PDF, JPEG, or PNG.');
}

/**
 * @param {string} url
 * @param {string} [name]
 * @returns {Promise<Record<string, string | null>>}
 */
export async function scanHospitalReferralFromUrl(url, name = 'referral') {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Could not download file (${res.status}).`);
  const blob = await res.blob();
  const file = new File([blob], name, { type: blob.type || 'application/octet-stream' });
  return scanHospitalReferralFromFile(file);
}
