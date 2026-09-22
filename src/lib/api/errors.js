// Turns Supabase/Postgres/network errors into messages a person can act on.
export function friendlyError(error, fallback = "Something went wrong. Please try again.") {
  if (!error) return fallback;
  const message = String(error.message || error.error_description || error || "");
  if (/failed to fetch|networkerror|load failed/i.test(message)) return "Can't reach the server. Check your connection and try again.";
  if (/invalid login credentials/i.test(message)) return "Wrong email/username or password.";
  if (/email not confirmed/i.test(message)) return "Please confirm your email first. Check your inbox for the link.";
  if (/user already registered/i.test(message)) return "An account with that email already exists. Try signing in.";
  if (/password should be at least/i.test(message)) return "Password must be at least 8 characters.";
  if (/rate limit|too many requests/i.test(message)) return "Too many attempts. Please wait a minute and try again.";
  if (/jwt expired|invalid jwt/i.test(message)) return "Your session has expired. Please sign in again.";
  if (/row-level security|permission denied/i.test(message)) return "You don't have permission to do that.";
  if (/payload too large|exceeded the maximum allowed size/i.test(message)) return "That file is too large (max 5 MB).";
  if (/mime type|invalid_mime_type/i.test(message)) return "Only JPEG, PNG or WebP images can be uploaded.";
  // Messages raised by our own database functions are already written for people.
  if (message && message.length < 160 && !/^(PGRST|[A-Z0-9]{5}:)/.test(message)) return message.replace(/^Error:\s*/, "");
  return fallback;
}

export class ApiError extends Error {
  constructor(error, fallback) {
    super(friendlyError(error, fallback));
    this.name = "ApiError";
    this.cause = error;
  }
}
