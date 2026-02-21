import crypto from 'crypto';

// We derive a strictly 32-byte key from the environment variable for AES-256
const getSecretKey = () => {
    const secret = process.env.AUTO_EVAL_SECRET_KEY || process.env.ENCRYPT_SECRET_KEY || 'fallback_dev_key_only_change_in_prod';
    return crypto.createHash('sha256').update(String(secret)).digest();
};

const ALGORITHM = 'aes-256-cbc';

/**
 * Encrypt a plain-text string using AES-256-CBC
 * @param {string} text Plain text password
 * @returns {object} { iv: string, encryptedData: string }
 */
export function encryptPassword(text) {
    if (!text) return null;
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(ALGORITHM, getSecretKey(), iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return {
        iv: iv.toString('hex'),
        encryptedData: encrypted
    };
}

/**
 * Decrypt an encrypted string using AES-256-CBC
 * @param {string} encryptedData 
 * @param {string} ivHex 
 * @returns {string} Decrypted original password
 */
export function decryptPassword(encryptedData, ivHex) {
    if (!encryptedData || !ivHex) return null;
    try {
        const iv = Buffer.from(ivHex, 'hex');
        const decipher = crypto.createDecipheriv(ALGORITHM, getSecretKey(), iv);
        let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        return decrypted;
    } catch (error) {
        console.error('[Crypto] Decryption failed:', error.message);
        return null;
    }
}
