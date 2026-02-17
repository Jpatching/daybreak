/** Strip HTML/script tags and control characters from on-chain data */
export function sanitizeString(input: string): string {
  if (typeof input !== 'string') return '';
  return input
    .replace(/<[^>]*>/g, '')           // strip HTML tags
    .replace(/[\x00-\x1F\x7F]/g, '')   // strip control chars
    .trim()
    .slice(0, 100);                     // cap length
}
