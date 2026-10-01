/** `scheme://user:password@host` → `scheme://***@host`, anywhere in a piece of text. */
const URL_CREDENTIALS = /(\/\/)[^\s/@"']+@/g;

/**
 * Removes credentials embedded in URLs (database and Redis connection strings) from text that
 * leaves the process: log lines and error reports. Client libraries put the full URL in their
 * error messages, so a connection error would otherwise print the password.
 */
export function redactUrlCredentials(text: string): string {
  return text.replace(URL_CREDENTIALS, '$1***@');
}
