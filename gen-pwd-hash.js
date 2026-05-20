const crypto = require('crypto');

const SALT_BYTES = 16;
const HASH_BYTES = 32;
const ITERATIONS = 100000;
const DIGEST = 'SHA-256';

function buf2hex(buf) {
  return Array.from(new Uint8Array(buf))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );
  const hashBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: salt.buffer,
      iterations: ITERATIONS,
      hash: DIGEST,
    },
    keyMaterial,
    HASH_BYTES * 8
  );
  const hash = new Uint8Array(hashBits);
  console.log(`pbkdf2:${buf2hex(salt.buffer)}:${buf2hex(hash.buffer)}`);
}

hashPassword('88888').catch(console.error);
