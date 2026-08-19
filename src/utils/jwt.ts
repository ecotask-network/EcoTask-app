/* Base64 decoding requires bit shifts; this is intentional and dependency-free. */
/* eslint-disable no-bitwise */

const BASE64_ALPHABET =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function base64UrlToString(input: string): string {
  const base64 = input.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=');

  let output = '';
  let buffer = 0;
  let bits = 0;

  for (const char of padded) {
    if (char === '=') {
      break;
    }
    const value = BASE64_ALPHABET.indexOf(char);
    if (value === -1) {
      continue;
    }
    buffer = (buffer << 6) | value;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      output += String.fromCharCode((buffer >> bits) & 0xff);
    }
  }

  return output;
}

/**
 * Decodes the `exp` claim from a JWT without any external library.
 * Returns the expiry as a millisecond timestamp, or `null` when the token is
 * malformed or has no numeric `exp` claim.
 */
export function decodeTokenExpiry(token: string): number | null {
  try {
    const segments = token.split('.');
    if (segments.length < 2) {
      return null;
    }
    const payload = JSON.parse(base64UrlToString(segments[1]));
    return typeof payload.exp === 'number' ? payload.exp * 1000 : null;
  } catch {
    return null;
  }
}
