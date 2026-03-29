/** Map Supabase Auth API errors to short UI messages */
export function formatAuthError(error) {
  if (!error?.message) return 'Something went wrong. Please try again.';
  const msg = error.message.toLowerCase();
  if (msg.includes('invalid login credentials')) {
    return 'Invalid email or password.';
  }
  if (msg.includes('email not confirmed')) {
    return 'Please confirm your email before signing in.';
  }
  if (msg.includes('user already registered')) {
    return 'An account with this email already exists.';
  }
  if (msg.includes('password')) {
    return error.message;
  }
  return error.message;
}
