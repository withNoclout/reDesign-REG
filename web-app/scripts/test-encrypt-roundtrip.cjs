// Exact replication of Angular's encryption using crypto-js
const CryptoJS = require('crypto-js');

const encryptSecretKey = "mySecretKeyHere";

function encryptData(plaintext) {
    // Step 1: Random 16-byte salt
    const salt = CryptoJS.lib.WordArray.random(16);

    // Step 2: PBKDF2 key derivation (keySize: 8 = 8 words = 256 bits)
    const key = CryptoJS.PBKDF2(encryptSecretKey, salt, { keySize: 8, iterations: 100 });

    // Step 3: Random 16-byte IV
    const iv = CryptoJS.lib.WordArray.random(16);

    // Step 4: AES-CBC encrypt with PKCS7
    const encrypted = CryptoJS.AES.encrypt(plaintext, key, {
        iv: iv,
        padding: CryptoJS.pad.Pkcs7,
        mode: CryptoJS.mode.CBC
    });

    // Step 5: Concatenate salt + iv + ciphertext, then base64
    const combined = salt.concat(iv).concat(encrypted.ciphertext);
    return CryptoJS.enc.Base64.stringify(combined);
}

// Test: encrypt then decrypt to verify
function decryptData(base64Str) {
    const data = CryptoJS.enc.Base64.parse(base64Str);
    const dataArray = [];
    for (let i = 0; i < data.sigBytes; i++) {
        dataArray.push((data.words[i >>> 2] >>> (24 - (i % 4) * 8)) & 0xff);
    }

    // Extract salt (first 16 bytes), IV (next 16 bytes), ciphertext (rest)
    const saltWords = CryptoJS.lib.WordArray.create(data.words.slice(0, 4), 16);
    const ivWords = CryptoJS.lib.WordArray.create(data.words.slice(4, 8), 16);
    const ciphertextLen = data.sigBytes - 32;
    const ciphertextWords = CryptoJS.lib.WordArray.create(data.words.slice(8), ciphertextLen);

    // Derive same key
    const key = CryptoJS.PBKDF2(encryptSecretKey, saltWords, { keySize: 8, iterations: 100 });

    // Decrypt
    const decrypted = CryptoJS.AES.decrypt(
        { ciphertext: ciphertextWords },
        key,
        { iv: ivWords, padding: CryptoJS.pad.Pkcs7, mode: CryptoJS.mode.CBC }
    );

    return decrypted.toString(CryptoJS.enc.Utf8);
}

// Test roundtrip
const testData = '{"Q220":"5","Q221":"5","Ctxt":"test","complaints":""}';
console.log('Original:', testData);

const encrypted = encryptData(testData);
console.log('Encrypted:', encrypted);

const decrypted = decryptData(encrypted);
console.log('Decrypted:', decrypted);
console.log('Match:', testData === decrypted ? '✅ YES' : '❌ NO');
