// Shared Groq model defaults. Groq retires models regularly (llama-3.3-70b-versatile and
// llama-3.2-11b-vision-preview are no longer available to this project's key), so keep the
// defaults in one place. Override per environment with VITE_GROQ_REFERRAL_TEXT_MODEL /
// VITE_GROQ_REFERRAL_SCAN_MODEL.

export const DEFAULT_GROQ_TEXT_MODEL = 'openai/gpt-oss-120b';
export const DEFAULT_GROQ_VISION_MODEL = 'qwen/qwen3.8-27b';

export function groqTextModel() {
  return import.meta.env.VITE_GROQ_REFERRAL_TEXT_MODEL?.trim() || DEFAULT_GROQ_TEXT_MODEL;
}

export function groqVisionModel() {
  return import.meta.env.VITE_GROQ_REFERRAL_SCAN_MODEL?.trim() || DEFAULT_GROQ_VISION_MODEL;
}

/**
 * gpt-oss models spend completion tokens on hidden reasoning before the JSON answer;
 * keep that short so small max_tokens budgets still leave room for the actual content.
 */
export function groqReasoningParams(model) {
  return String(model).startsWith('openai/gpt-oss') ? { reasoning_effort: 'low' } : {};
}
