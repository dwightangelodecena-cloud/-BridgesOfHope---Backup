export function isInvalidRefreshTokenError(error: { message?: string } | null | undefined): boolean {
  const msg = String(error?.message || "").toLowerCase();
  return msg.includes("invalid refresh token") || msg.includes("refresh token not found");
}

export function formatAuthError(error: { message?: string } | null): string {
  if (!error?.message) return "Something went wrong. Please try again.";
  const msg = error.message.toLowerCase();
  if (msg.includes("invalid login credentials")) {
    return "Invalid email or password.";
  }
  if (msg.includes("email not confirmed")) {
    return "Please confirm your email before signing in.";
  }
  if (msg.includes("user already registered")) {
    return "An account with this email already exists.";
  }
  if (msg.includes("email rate limit") || (msg.includes("rate limit") && msg.includes("email"))) {
    return "Too many verification emails were sent from this project. Wait a while and try again, or ask an admin to raise the cap in the Supabase dashboard under Authentication → Rate limits.";
  }
  if (msg.includes("password")) {
    return error.message;
  }
  return error.message;
}
