export const PASSWORD_MIN_LENGTH = 8;

const SPECIAL_RE = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?`~]/;

export function getPasswordStrengthChecks(password: string) {
  const p = password ?? "";
  const lengthOk = p.length >= PASSWORD_MIN_LENGTH;
  const upper = /[A-Z]/.test(p);
  const lower = /[a-z]/.test(p);
  const number = /\d/.test(p);
  const special = SPECIAL_RE.test(p);
  const noSpaces = !/\s/.test(p);
  const isValid = lengthOk && upper && lower && number && special && noSpaces;
  return { lengthOk, upper, lower, number, special, noSpaces, isValid };
}

export function getPasswordPolicyError(password: string): string | null {
  const p = password ?? "";
  if (!p.trim()) return "Password is required";
  if (/\s/.test(p)) return "Password must not contain spaces.";
  if (p.length < PASSWORD_MIN_LENGTH) {
    return `Password must be at least ${PASSWORD_MIN_LENGTH} characters long.`;
  }
  if (!/[A-Z]/.test(p)) return "Password must include at least one uppercase letter.";
  if (!/[a-z]/.test(p)) return "Password must include at least one lowercase letter.";
  if (!/\d/.test(p)) return "Password must include at least one number.";
  if (!SPECIAL_RE.test(p)) {
    return "Password must include at least one special character (e.g. ! @ # $ % ^ & *).";
  }
  return null;
}
