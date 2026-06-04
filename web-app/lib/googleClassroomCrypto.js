import crypto from 'crypto';

const CIPHER_ALGORITHM = 'aes-256-gcm';
const IV_LENGTH_BYTES = 12;
const AUTH_TAG_LENGTH_BYTES = 16;

function getGoogleClassroomEncryptionKey() {
    const rawKey = process.env.GOOGLE_CLASSROOM_TOKEN_ENCRYPTION_KEY;
    if (!rawKey) {
        throw new Error('GOOGLE_CLASSROOM_TOKEN_ENCRYPTION_KEY is required for Google Classroom token encryption');
    }
    return crypto.createHash('sha256').update(rawKey, 'utf8').digest();
}

export function encryptGoogleClassroomToken(plaintext) {
    if (!plaintext) return null;

    const iv = crypto.randomBytes(IV_LENGTH_BYTES);
    const cipher = crypto.createCipheriv(CIPHER_ALGORITHM, getGoogleClassroomEncryptionKey(), iv);
    const encrypted = Buffer.concat([
        cipher.update(String(plaintext), 'utf8'),
        cipher.final(),
    ]);
    const authTag = cipher.getAuthTag();

    return Buffer.concat([iv, authTag, encrypted]).toString('base64url');
}

export function decryptGoogleClassroomToken(ciphertext) {
    if (!ciphertext) return null;

    const payload = Buffer.from(ciphertext, 'base64url');
    if (payload.length <= IV_LENGTH_BYTES + AUTH_TAG_LENGTH_BYTES) {
        throw new Error('Invalid Google Classroom token payload');
    }

    const iv = payload.subarray(0, IV_LENGTH_BYTES);
    const authTag = payload.subarray(IV_LENGTH_BYTES, IV_LENGTH_BYTES + AUTH_TAG_LENGTH_BYTES);
    const encrypted = payload.subarray(IV_LENGTH_BYTES + AUTH_TAG_LENGTH_BYTES);

    const decipher = crypto.createDecipheriv(CIPHER_ALGORITHM, getGoogleClassroomEncryptionKey(), iv);
    decipher.setAuthTag(authTag);

    return Buffer.concat([
        decipher.update(encrypted),
        decipher.final(),
    ]).toString('utf8');
}
