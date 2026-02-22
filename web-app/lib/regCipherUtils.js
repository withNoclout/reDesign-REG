import crypto from 'crypto';

/**
 * Encrypt payload for reg2/reg3/reg4 API communication.
 * This utilizes PBKDF2 (SHA1, 100 iterations) and AES-256-CBC 
 * which is the exact mapping expected by the university's backend.
 * 
 * @param {string} plaintext - The raw string (usually JSON) to be encrypted
 * @returns {string} - Base64 encoded byte array: Salt(16) + IV(16) + Ciphertext
 */
export function encryptForReg(plaintext) {
    const ENCRYPT_SECRET_KEY = process.env.ENCRYPT_SECRET_KEY;
    if (!ENCRYPT_SECRET_KEY) {
        throw new Error('ENCRYPT_SECRET_KEY is not set in the environment variables');
    }

    const salt = crypto.randomBytes(16);
    // PBKDF2 with SHA1, 32 bytes (256-bit key), 100 iterations
    const derivedKey = crypto.pbkdf2Sync(ENCRYPT_SECRET_KEY, salt, 100, 32, 'sha1');
    const iv = crypto.randomBytes(16);

    const cipher = crypto.createCipheriv('aes-256-cbc', derivedKey, iv);
    cipher.setAutoPadding(true); // PKCS7 padding

    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);

    // Output format expected by university API: Base64(salt + iv + ciphertext)
    return Buffer.concat([salt, iv, encrypted]).toString('base64');
}
