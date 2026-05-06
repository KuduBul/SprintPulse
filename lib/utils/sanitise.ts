/**
 * XSS Sanitisation Utility
 *
 * Strips HTML tags and script elements from free-text input to prevent
 * cross-site scripting (XSS) attacks when displaying user-submitted content.
 *
 * @module lib/utils/sanitise
 */

/**
 * Strips all HTML tags from the input string, preserving only text content.
 * Handles script/style elements (removes their content entirely), nested tags,
 * malformed HTML, and various XSS attack vectors.
 *
 * @param input - The string to sanitise. If null or undefined, returns empty string.
 * @returns The sanitised string with all HTML tags removed.
 */
export function sanitise(input: string | null | undefined): string {
  if (input == null) {
    return '';
  }

  if (typeof input !== 'string') {
    return '';
  }

  let result = input;

  // Remove script and style tags along with their content (case-insensitive, handles attributes)
  result = result.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script\s*>/gi, '');
  result = result.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style\s*>/gi, '');

  // Remove all remaining HTML tags (including self-closing, malformed, and with attributes)
  result = result.replace(/<\/?[a-z][^>]*>/gi, '');

  // Remove any remaining angle-bracket patterns that look like tags (catches malformed HTML)
  result = result.replace(/<[^>]*>/g, '');

  // Decode common HTML entities that might be used to bypass sanitisation
  result = result.replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
  result = result.replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(parseInt(dec, 10)));
  result = result.replace(/&lt;/g, '<');
  result = result.replace(/&gt;/g, '>');
  result = result.replace(/&amp;/g, '&');
  result = result.replace(/&quot;/g, '"');
  result = result.replace(/&apos;/g, "'");

  // After decoding entities, strip any tags that were hidden via encoding
  result = result.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script\s*>/gi, '');
  result = result.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style\s*>/gi, '');
  result = result.replace(/<\/?[a-z][^>]*>/gi, '');
  result = result.replace(/<[^>]*>/g, '');

  return result.trim();
}
