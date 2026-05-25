export function isNetworkError(e: unknown): boolean {
  if (!(e instanceof Error)) return false;
  const lower = e.message.toLowerCase();
  return (
    lower.includes('network request failed') ||
    lower.includes('failed to fetch') ||
    lower.includes('econnreset') ||
    lower.includes('connection reset') ||
    lower.includes('unable to connect')
  );
}

export function friendlyApiError(e: unknown): string {
  if (!(e instanceof Error)) return 'Something went wrong. Please try again.';

  const msg = e.message;
  const lower = msg.toLowerCase();

  if (
    lower.includes('network request failed') ||
    lower.includes('failed to fetch') ||
    lower.includes('econnreset') ||
    lower.includes('connection reset') ||
    lower.includes('unable to connect')
  ) {
    return 'Connection lost. Check your network and try again.';
  }
  if (msg.startsWith('authentication_error') || lower.includes('x-api-key') || lower.includes('invalid api key')) {
    return 'Invalid API key. Double-check your key in Settings.';
  }
  if (msg.startsWith('rate_limit_error') || lower.includes('rate limit') || lower.includes('too many requests')) {
    return 'Rate limit reached. Please wait a moment and try again.';
  }
  if (msg.startsWith('overloaded_error') || lower.includes('overloaded')) {
    return 'Claude is overloaded right now. Try again in a moment.';
  }
  if (lower.includes('credit balance') || lower.includes('billing') || lower.includes('insufficient')) {
    return 'Insufficient API credits. Add credits at console.anthropic.com.';
  }
  if (msg.startsWith('permission_error') || lower.includes('permission_error')) {
    return 'API key permission error. Check your key settings.';
  }

  // Strip the "type:" prefix we add when throwing, return just the message
  const colonIdx = msg.indexOf(':');
  if (colonIdx > 0 && colonIdx < 30) return msg.slice(colonIdx + 1).trim();
  return msg;
}
