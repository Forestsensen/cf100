/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * password.ts — Edge Runtime compatible password hashing
 * Uses Web Crypto API (PBKDF2) instead of Node.js scrypt.
 * Storage format: `pbkdf2:<salt_hex>:<hash_hex>`
 * Legacy plain-text passwords are still recognised for backwards compatibility.
 */

const SALT_BYTES = 16;
const HASH_BYTES = 32;
const ITERATIONS = 100_000;
const DIGEST = 'SHA-256';

function buf2hex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function hex2buf(hex: string): Uint8Array {
  const arr = new Uint8Array(hex.length / 2);
  for (let i = 0; i < arr.length; i++) {
    arr[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return arr;
}

async function pbkdf2(
  password: string,
  salt: Uint8Array
): Promise<ArrayBuffer> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );
  return crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt,
      iterations: ITERATIONS,
      hash: DIGEST,
    },
    keyMaterial,
    HASH_BYTES * 8
  );
}

/**
 * Hash a password. Returns `pbkdf2:<salt_hex>:<hash_hex>`.
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const hash = await pbkdf2(password, salt);
  return `pbkdf2:${buf2hex(salt.buffer)}:${buf2hex(hash)}`;
}

/**
 * Verify a password against a stored value.
 * Supports:
 *   - New format: `pbkdf2:<salt_hex>:<hash_hex>`
 *   - Old scrypt format: `<salt_hex>:<hash_hex>` (falls through to plain-text check)
 *   - Plain-text (legacy)
 */
export async function verifyPassword(
  password: string,
  storedValue: string
): Promise<boolean> {
  if (storedValue.startsWith('pbkdf2:')) {
    const parts = storedValue.split(':');
    if (parts.length !== 3) return false;
    const salt = hex2buf(parts[1]);
    const storedHash = hex2buf(parts[2]);
    const derived = new Uint8Array(await pbkdf2(password, salt));
    if (derived.length !== storedHash.length) return false;
    // constant-time comparison
    let diff = 0;
    for (let i = 0; i < derived.length; i++) diff |= derived[i] ^ storedHash[i];
    return diff === 0;
  }

  // Legacy plain-text comparison
  return storedValue === password;
}

/**
 * Returns true if the stored value is a recognised hashed format.
 */
export function isHashed(storedValue: string): boolean {
  return storedValue.startsWith('pbkdf2:');
}
