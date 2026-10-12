import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function generateTotpSecret() {
  const bytes = randomBytes(20);
  let bits = 0;
  let value = 0;
  let output = '';
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) { output += alphabet[(value >>> (bits - 5)) & 31]; bits -= 5; }
  }
  if (bits > 0) output += alphabet[(value << (5 - bits)) & 31];
  return output;
}

export function generateRecoveryCodes() {
  const codes = Array.from({ length: 10 }, () => randomBytes(9).toString('base64url').toUpperCase());
  return { codes, hashes: codes.map(code => hashRecoveryCode(code)) };
}

export function hashRecoveryCode(code: string) {
  return createHash('sha256').update(code.trim().toUpperCase()).digest('hex');
}

function decodeBase32(value: string) {
  const normalized = value.toUpperCase().replace(/=+$/g, '').replace(/\s/g, '');
  let bits = 0;
  let buffer = 0;
  const output: number[] = [];
  for (const character of normalized) {
    const index = alphabet.indexOf(character);
    if (index < 0) throw new Error('Invalid base32 secret');
    buffer = (buffer << 5) | index; bits += 5;
    if (bits >= 8) { output.push((buffer >>> (bits - 8)) & 255); bits -= 8; }
  }
  return Buffer.from(output);
}

function encryptionKey() {
  const key = Buffer.from(process.env.MFA_ENCRYPTION_KEY ?? '', 'base64');
  if (key.length !== 32) throw new Error('MFA_ENCRYPTION_KEY must be a base64 encoded 32-byte key.');
  return key;
}

export function hasMfaEncryptionKey() {
  return Buffer.from(process.env.MFA_ENCRYPTION_KEY ?? '', 'base64').length === 32;
}

export function encryptTotpSecret(secret: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);
  return `v1.${iv.toString('base64url')}.${cipher.getAuthTag().toString('base64url')}.${ciphertext.toString('base64url')}`;
}

function decryptTotpSecret(encrypted: string) {
  const [version, ivText, tagText, bodyText] = encrypted.split('.');
  if (version !== 'v1' || !ivText || !tagText || !bodyText) throw new Error('Invalid encrypted TOTP secret');
  const decipher = createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(ivText, 'base64url'));
  decipher.setAuthTag(Buffer.from(tagText, 'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(bodyText, 'base64url')), decipher.final()]).toString('utf8');
}

function codeFor(secret: string, step: number) {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(step));
  const digest = createHmac('sha1', decodeBase32(secret)).update(counter).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const binary = ((digest[offset] & 0x7f) << 24) | ((digest[offset + 1] & 0xff) << 16) | ((digest[offset + 2] & 0xff) << 8) | (digest[offset + 3] & 0xff);
  return String(binary % 1_000_000).padStart(6, '0');
}

export function verifyTotpSecret(encryptedSecret: string, rawCode: string, now = Date.now()) {
  const code = rawCode.replace(/\s/g, '');
  if (!/^\d{6}$/.test(code)) return false;
  const secret = decryptTotpSecret(encryptedSecret);
  const step = Math.floor(now / 30_000);
  const supplied = Buffer.from(code);
  return [-1, 0, 1].some(offset => {
    const expected = Buffer.from(codeFor(secret, step + offset));
    return timingSafeEqual(supplied, expected);
  });
}

export function totpProvisioningUri(secret: string, email: string) {
  const label = encodeURIComponent(`Flow ERP:${email}`);
  return `otpauth://totp/${label}?secret=${secret}&issuer=Flow%20ERP&algorithm=SHA1&digits=6&period=30`;
}
