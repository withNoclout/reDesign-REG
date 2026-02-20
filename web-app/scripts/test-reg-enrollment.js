const https = require('https');
const axios = require('axios');
const crypto = require('crypto');
const zlib = require('zlib');
const { promisify } = require('util');

const gunzip = promisify(zlib.gunzip);

// Credentials
const username = "s6701091611290";
const password = "035037603za";

// Setup Encryption Helper
function encryptData(plaintext) {
    const ENCRYPT_SECRET_KEY = 'mySecretKeyHere';
    const salt = crypto.randomBytes(16);
    const derivedKey = crypto.pbkdf2Sync(ENCRYPT_SECRET_KEY, salt, 100, 32, 'sha1');
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', derivedKey, iv);
    cipher.setAutoPadding(true);
    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    return Buffer.concat([salt, iv, encrypted]).toString('base64');
}

async function decodeGzipResponse(base64String) {
    if (!base64String) return null;
    try {
        const compressedBuffer = Buffer.from(base64String, 'base64');
        const decompressed = await gunzip(compressedBuffer);
        return JSON.parse(decompressed.toString('utf-8'));
    } catch (e) {
        return null;
    }
}

const BASE_URL_V1 = 'https://reg4.kmutnb.ac.th/regapiweb1/api/th';
const BASE_URL_V2 = 'https://reg4.kmutnb.ac.th/regapiweb2/api/th';

const httpsAgent = new https.Agent({
    rejectUnauthorized: false
});

async function runResearch() {
    try {
        console.log('--- ENROLLMENT API COMPREHENSIVE DUMP ---\n');

        // 1. Auth Flow
        const authStartRes = await axios.get(`${BASE_URL_V2}/Validate/tokenservice`, { httpsAgent });
        const serviceToken = authStartRes.data.token;
        const credentials = JSON.stringify({ username, password, ip: "127.0.0.1" });
        const encryptedParam = encryptData(credentials);
        const loginRes = await axios.post(`${BASE_URL_V2}/Account/LoginAD`, { param: encryptedParam }, {
            headers: { 'Authorization': `Bearer ${serviceToken}` },
            httpsAgent
        });
        const token = loginRes.data.token;
        console.log('✅ Login successful!\n');

        const apiClientV1 = axios.create({ baseURL: BASE_URL_V1, httpsAgent, headers: { 'Authorization': `Bearer ${token}` } });
        const apiClientV2 = axios.create({ baseURL: BASE_URL_V2, httpsAgent, headers: { 'Authorization': `Bearer ${token}` } });

        // 2. Fetch Enrollment Initial Data (V1)
        console.log('--- Fetching Enrollment Init Data (regapiweb1/Enroll/GetInitData) ---');
        const initRes = await apiClientV1.get('/Enroll/GetInitData');
        if (initRes.data?.result) {
            const decoded = await decodeGzipResponse(initRes.data.result);
            console.log('✅ Init Data:', JSON.stringify(decoded, null, 2));
        } else {
            console.log('❌ No result in Init Data');
        }

        // 3. Fetch Class Lab for a known course
        const courseId = 17365; // Example from Timetable result
        console.log(`\n--- Fetching Class Lab for Course ID ${courseId} ---`);
        const classLabRes = await apiClientV1.get(`/Enroll/Getclasslab/${courseId}`);
        if (classLabRes.data?.result) {
            const decoded = await decodeGzipResponse(classLabRes.data.result);
            console.log('✅ Class Lab Decode Success. First item snippet:', JSON.stringify(decoded[0]).substring(0, 300));
        }

        // 4. Summarize and Print Result
        console.log('\n--- RESEARCH SUMMARY ---');
        console.log('Base V1:', BASE_URL_V1);
        console.log('Base V2:', BASE_URL_V2);
        console.log('Use PUT to /Enroll/Insertstudyplan/{year}/{sem} to save registration.');
        console.log('Use GET to /Enroll/Submit to validate transaction.');

    } catch (err) {
        console.error('Fatal Error:', err.message);
    }
}

runResearch();
