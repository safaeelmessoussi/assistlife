/**
 * End-to-end encryption for the backup.
 *
 * One password does two jobs without the server ever learning it: it is
 * stretched on the device into two independent secrets. One half signs the
 * user in; the other half is the encryption key and never leaves the device.
 * The server therefore stores only ciphertext it cannot read.
 */
import { xchacha20poly1305 } from '@noble/ciphers/chacha.js';
import { scryptAsync } from '@noble/hashes/scrypt.js';
import { bytesToHex, hexToBytes, utf8ToBytes } from '@noble/hashes/utils.js';

const FORMAT_VERSION = 1;
const NONCE_BYTES = 24;
/** scrypt cost: about 32 MB of memory per derivation. */
const SCRYPT = { N: 2 ** 15, r: 8, p: 1, dkLen: 64 };

export type DerivedKeys = {
  /** Sent to the server as the account password. Reveals nothing about the encryption key. */
  authSecret: string;
  /** Encrypts the backup. Stays on the device. Hex, 32 bytes. */
  encKey: string;
};

export const normalizeEmail = (email: string) => email.trim().toLowerCase();

export async function deriveKeys(email: string, password: string): Promise<DerivedKeys> {
  const salt = utf8ToBytes(`assistlife/v1/${normalizeEmail(email)}`);
  const out = await scryptAsync(utf8ToBytes(password.normalize('NFKC')), salt, SCRYPT);
  return { authSecret: bytesToHex(out.slice(0, 32)), encKey: bytesToHex(out.slice(32)) };
}

function randomBytes(length: number): Uint8Array {
  return globalThis.crypto.getRandomValues(new Uint8Array(length));
}

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

export function toBase64(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i];
    const b = bytes[i + 1];
    const c = bytes[i + 2];
    out += B64[a >> 2] + B64[((a & 3) << 4) | ((b ?? 0) >> 4)];
    out += b === undefined ? '=' : B64[((b & 15) << 2) | ((c ?? 0) >> 6)];
    out += c === undefined ? '=' : B64[c & 63];
  }
  return out;
}

export function fromBase64(text: string): Uint8Array {
  const clean = text.replace(/=+$/, '');
  const out = new Uint8Array(Math.floor((clean.length * 3) / 4));
  let buffer = 0;
  let bits = 0;
  let index = 0;
  for (const ch of clean) {
    const value = B64.indexOf(ch);
    if (value < 0) throw new Error('Invalid base64');
    buffer = (buffer << 6) | value;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out[index++] = (buffer >> bits) & 255;
    }
  }
  return out;
}

/** UTF-8 bytes → text, written out because not every phone runtime has a built-in decoder. */
function utf8Decode(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; ) {
    const b = bytes[i++];
    let code: number;
    if (b < 0x80) code = b;
    else if (b < 0xe0) code = ((b & 0x1f) << 6) | (bytes[i++] & 0x3f);
    else if (b < 0xf0) code = ((b & 0x0f) << 12) | ((bytes[i++] & 0x3f) << 6) | (bytes[i++] & 0x3f);
    else code = ((b & 0x07) << 18) | ((bytes[i++] & 0x3f) << 12) | ((bytes[i++] & 0x3f) << 6) | (bytes[i++] & 0x3f);
    out += String.fromCodePoint(code);
  }
  return out;
}

/** Encrypt a JSON-serialisable value. Output: base64 of version | nonce | ciphertext. */
export function encryptJson(encKey: string, value: unknown): string {
  const nonce = randomBytes(NONCE_BYTES);
  const sealed = xchacha20poly1305(hexToBytes(encKey), nonce).encrypt(utf8ToBytes(JSON.stringify(value)));
  const out = new Uint8Array(1 + NONCE_BYTES + sealed.length);
  out[0] = FORMAT_VERSION;
  out.set(nonce, 1);
  out.set(sealed, 1 + NONCE_BYTES);
  return toBase64(out);
}

/** Decrypt what `encryptJson` produced. Throws when the key is wrong or the data was altered. */
export function decryptJson<T>(encKey: string, payload: string): T {
  const bytes = fromBase64(payload);
  if (bytes[0] !== FORMAT_VERSION) throw new Error('Unsupported backup format');
  const nonce = bytes.slice(1, 1 + NONCE_BYTES);
  const opened = xchacha20poly1305(hexToBytes(encKey), nonce).decrypt(bytes.slice(1 + NONCE_BYTES));
  return JSON.parse(utf8Decode(opened)) as T;
}
