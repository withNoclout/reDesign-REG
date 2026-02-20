const https = require('https');
const axios = require('axios');
const crypto = require('crypto');

// Need to pass these or use dotenv
const username = "s6701091611290";
const password = "035037603za";

// Setup Encryption Helper
function encryptData(plaintext) {
    const ENCRYPT_SECRET_KEY = 'mySecretKeyHere'; // the original test-university-auth.js fallback or env
    const salt = crypto.randomBytes(16);
    const derivedKey = crypto.pbkdf2Sync(ENCRYPT_SECRET_KEY, salt, 100, 32, 'sha1');
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', derivedKey, iv);
    cipher.setAutoPadding(true);
    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    return Buffer.concat([salt, iv, encrypted]).toString('base64');
}

const BASE_URL = 'https://reg4.kmutnb.ac.th/regapiweb2/api/th';

// Create HTTPS agent that ignores self-signed certificate errors
const httpsAgent = new https.Agent({
    rejectUnauthorized: false
});

async function testRegistrationAPI() {
    try {
        console.log('--- REGISTRATION API RESEARCH DUMP ---\n');

        // 1. Get Token Service
        const authStartRes = await axios.get(`${BASE_URL}/Validate/tokenservice`, {
            httpsAgent
        });
        const serviceToken = authStartRes.data.token;

        // 2. Login
        console.log('Attempting login...');
        const credentials = JSON.stringify({ username, password, ip: "127.0.0.1" });
        const encryptedParam = encryptData(credentials);

        const loginRes = await axios.post(
            `${BASE_URL}/Account/LoginAD`,
            { param: encryptedParam },
            {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${serviceToken}`
                },
                httpsAgent,
                validateStatus: status => true
            }
        );

        if (loginRes.status !== 200 || !loginRes.data.token) {
            throw new Error(`Login Failed! Status: ${loginRes.status}, Data: ${JSON.stringify(loginRes.data)}`);
        }

        const token = loginRes.data.token;
        console.log('Login successful!\n');

        // Axios instance with token
        const apiClient = axios.create({
            baseURL: BASE_URL,
            httpsAgent,
            headers: {
                'Authorization': `Bearer ${token}`
            },
            validateStatus: status => true
        });

        // 3. Test Student Data just to confirm auth
        console.log('--- Fetching Student Info ---');
        const studentRes = await apiClient.get('/Schg/Getacadstd');
        console.log(`Status: ${studentRes.status}`);
        const studentData = Array.isArray(studentRes.data) ? studentRes.data[0] : studentRes.data;
        console.log(`Student Data raw:`, JSON.stringify(studentData).substring(0, 100));
        const studentId = studentData?.studentid || '357458';
        console.log(`Parsed Student ID: ${studentId}\n`);

        // 4. Test Registration Endpoints (Mentioned in API_CONTEXT)
        console.log('--- Fetching Enrollment Control (/Student/Getenrollcontrol) ---');
        try {
            const enrollControl = await apiClient.get('/Student/Getenrollcontrol');
            console.log(JSON.stringify(enrollControl.data, null, 2));
        } catch (e) {
            console.log(`Failed: ${e.response?.status} - ${e.response?.data}`);
        }

        console.log('\n--- Fetching Enrollment Stage (/Student/Getenrollstage) ---');
        try {
            const enrollStage = await apiClient.get('/Student/Getenrollstage', { params: { studentid: studentId } });
            console.log(JSON.stringify(enrollStage.data, null, 2));
        } catch (e) {
            try {
                const enrollStage2 = await apiClient.get('/Student/Getenrollstage');
                console.log(JSON.stringify(enrollStage2.data, null, 2));
            } catch (e2) {
                console.log(`Failed: ${e2.response?.status} - ${e2.response?.data}`);
            }
        }

        // Attempting to guess other common registration endpoints:
        console.log('\n--- Guessing Registration List Endpoints ---');
        const guessEndpoints = [
            '/Student/Getregis',
            '/Student/Getenrolldata',
            '/Regis/Get',
            '/Student/Getenrollment',
            '/Student/Getenroll',
            `/Student/GetEnrollment?studentid=${studentId}`,
            '/Course/GetOpenCourse',
            '/Enroll/GetClassSchedule'
        ];

        for (const ep of guessEndpoints) {
            try {
                const res = await apiClient.get(ep);
                console.log(`[SUCCESS] ${ep} - Status: ${res.status}`);
                console.log(JSON.stringify(res.data).substring(0, 500) + '...');
            } catch (e) {
                console.log(`[FAILED] ${ep} - Status: ${e.response?.status}`);
                if (e.response?.status !== 404) {
                    console.log(`         Data: ${JSON.stringify(e.response?.data)}`);
                }
            }
        }

    } catch (error) {
        if (error.response) {
            console.error('\nAPI Error:', {
                status: error.response.status,
                data: error.response.data
            });
        } else {
            console.error('\nNetwork/Execution Error:', error.message);
        }
    }
}

testRegistrationAPI();
