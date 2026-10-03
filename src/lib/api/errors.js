// Turns Supabase/Postgres/network errors into messages a person can act on: what went wrong and
// what to do about it. Never shows raw database errors, codes or stack traces.

const TRY_AGAIN = "Try again in a moment.";
const DEFAULT_FALLBACK = "That didn't work. Try again in a moment, and reload the page if it keeps happening.";

// Messages from our own database functions are written for people, but a few are terse.
const REWORDED = [
  [/^admins only$/i, "Only admins can do that. Sign in with an admin account."],
  [/^sign in first$/i, "You've been signed out. Sign in and try again."],
  [/^unknown pub$/i, "That pub isn't in Pub Bingo any more. Reload the page to see the current list."],
  [/^(report|drink|deal|event|menu|suggestion) not found$/i, "That's already been removed. Reload the page to see the latest."],
  [/^you reported this drink a few minutes ago$/i, "You reported this drink a few minutes ago. You can report it again after 10 minutes."],
  [/^invalid vote$/i, "That vote didn't save. Reload the page and try again."],
  [/^you've sent 10 menus today/i, "You've sent 10 menus today, which is the daily limit. You can send more tomorrow."],
  [/^you've already checked this price today/i, "You've already confirmed this price today. You can confirm it again tomorrow."],
  [/^your account has no profile yet$/i, "Your account isn't fully set up. Sign out, sign in again, and try once more."]
];

// Raw database or programming errors that must never reach the screen.
const TECHNICAL = /duplicate key|violates|constraint|syntax error|column|relation|null value|function .* does not exist|undefined|cannot read prop|typeerror|unexpected token|json/i;

function isOffline() {
  return typeof navigator !== "undefined" && navigator.onLine === false;
}

// Adds "Try again in a moment." to a fallback that doesn't already say what to do.
function withNextStep(text) {
  return /try|check|sign in|reload|again|pick|enter|choose/i.test(text) ? text : `${text.replace(/\.?$/, ".")} ${TRY_AGAIN}`;
}

export function friendlyError(error, fallback = DEFAULT_FALLBACK) {
  const next = withNextStep(fallback);
  if (!error) return next;
  if (isOffline()) return "You're offline. Reconnect to the internet, then try again.";
  const name = String(error.name || "");
  const message = String(error.message || error.error_description || (typeof error === "string" ? error : "") || "");

  if (name === "TimeoutError" || /timed? ?out|signal timed out/i.test(message)) return "Pub Bingo is taking too long to answer. Check your connection and try again.";
  if (name === "AbortError" || /aborted/i.test(message)) return "The request was interrupted. Try again.";
  if (/failed to fetch|networkerror|load failed|network request failed/i.test(message)) return "Can't reach Pub Bingo. Check your connection and try again.";
  if (/invalid login credentials/i.test(message)) return "That email/username and password don't match. Check them and try again, or reset your password.";
  if (/email not confirmed/i.test(message)) return "Confirm your email first: open the link we sent you, then sign in.";
  if (/user already registered/i.test(message)) return "There's already an account with that email. Sign in instead, or reset your password.";
  if (/password should be at least/i.test(message)) return "Use a password of at least 8 characters.";
  if (/invalid path specified in request url/i.test(message)) return "The app's database address is set up wrong. VITE_SUPABASE_URL should be just https://xxxx.supabase.co.";
  if (/rate limit|too many requests/i.test(message)) return "Too many attempts in a short time. Wait a minute, then try again.";
  if (/jwt expired|invalid jwt/i.test(message)) return "You've been signed out because your session expired. Sign in again.";
  if (/row-level security|permission denied/i.test(message)) return "Your account isn't allowed to do that. If you think it should be, sign out and in again.";
  if (/payload too large|exceeded the maximum allowed size/i.test(message)) return "That file is too large. Use one under 5 MB.";
  if (/mime type|invalid_mime_type/i.test(message)) return "That file type can't be uploaded. Use a JPEG, PNG or WebP image.";

  const text = message.replace(/^Error:\s*/, "").trim();
  for (const [pattern, replacement] of REWORDED) if (pattern.test(text)) return replacement;
  // Messages raised by our own database functions are already written for people.
  if (text && text.length < 160 && !/^(PGRST|[A-Z0-9]{5}:)/.test(text) && !TECHNICAL.test(text)) return text.replace(/([^.!?])$/, "$1.");
  return next;
}

export class ApiError extends Error {
  constructor(error, fallback) {
    super(friendlyError(error, fallback));
    this.name = "ApiError";
    this.cause = error;
  }
}
