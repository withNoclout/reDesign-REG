const axios = require('axios');
const https = require('https');
const crypto = require('crypto');

const agent = new https.Agent({ rejectUnauthorized: false });
const BASE_URL = 'https://reg4.kmutnb.ac.th/regapiweb2/api/th';

// Encryption function (EXACT copy from working login route)
function encryptData(plaintext) {
    const secretKey = '0x86P@$$w012!reg!$#system';
    const salt = crypto.randomBytes(16);
    const derivedKey = crypto.pbkdf2Sync(secretKey, salt, 100, 32, 'sha1');
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', derivedKey, iv);
    cipher.setAutoPadding(true); // PKCS7 padding
    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    return Buffer.concat([salt, iv, encrypted]).toString('base64');
}

async function testReg3APIs() {
    try {
        console.log('=== Step 1: Get Public IP ===');
        let clientIp = '';
        try {
            const ipResponse = await axios.get('https://api.ipify.org/?format=json', { timeout: 3000 });
            clientIp = ipResponse.data?.ip || '';
            console.log('✅ Public IP:', clientIp);
        } catch (ipErr) {
            console.log('⚠️  Could not get public IP, using empty string');
        }
        
        console.log('\n=== Step 2: Get Token ===');
        const tokenRes = await axios.get(`${BASE_URL}/Validate/tokenservice`, { httpsAgent: agent });
        const token = tokenRes.data.token;
        console.log('✅ Token received:', token.substring(0, 50) + '...');
        
        console.log('\n=== Step 3: Login ===');
        const credentialsJson = JSON.stringify({ 
            username: 's6701091611290', 
            password: '035037603za', 
            ip: clientIp 
        });
        const encryptedParam = encryptData(credentialsJson);
        const requestBody = '{"param" : "' + encryptedParam + '"}';
        
        const loginRes = await axios.post(
            `${BASE_URL}/Account/LoginAD`,
            requestBody,
            {
                httpsAgent: agent,
                headers: { 
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                validateStatus: () => true
            }
        );
        
        if (loginRes.status !== 200 || !loginRes.data.token) {
            console.log('❌ Login failed:', loginRes.status);
            console.log('Response:', JSON.stringify(loginRes.data, null, 2));
            return;
        }
        
        const sessionToken = loginRes.data.token;
        console.log('✅ Login successful');
        console.log('Session token:', sessionToken.substring(0, 50) + '...');
        
        const apiConfig = {
            httpsAgent: agent,
            headers: { 
                'Authorization': `Bearer ${sessionToken}`,
                'Content-Type': 'application/json'
            },
            validateStatus: () => true,
            timeout: 10000
        };
        
        console.log('\n=== Step 4: Fetch Timetable (Enroll/Timetable) ===');
        const timetableRes = await axios.get(`${BASE_URL}/Enroll/Timetable`, apiConfig);
        console.log('Status:', timetableRes.status);
        if (timetableRes.status === 200) {
            console.log('✅ Timetable Data:');
            console.log(JSON.stringify(timetableRes.data, null, 2));
        } else {
            console.log('❌ Failed:', timetableRes.data);
        }
        
        console.log('\n=== Step 5: Try Different Enroll Endpoints ===');
        const enrollEndpoints = [
            'Enroll/Result',
            'Enroll/Enrollresult',
            'Enroll/GetEnrollResult',
            'Enroll/ShowEnroll',
            'Enroll/GetEnroll',
            'Enroll/EnrollCourse'
        ];
        
        for (const endpoint of enrollEndpoints) {
            console.log(`\n📍 Trying: ${endpoint}`);
            const res = await axios.get(`${BASE_URL}/${endpoint}`, apiConfig);
            console.log('   Status:', res.status);
            if (res.status === 200 && res.data) {
                console.log('   ✅ SUCCESS!');
                console.log('   Data:', JSON.stringify(res.data, null, 2));
            } else {
                console.log('   ❌ Response:', JSON.stringify(res.data).substring(0, 100));
            }
        }
        
        console.log('\n=== Step 6: Additional API Exploration ===');
        const otherEndpoints = [
            'Grade/Showgrade',
            'Schg/Getacadstd',
            'Enroll/GetSubject'
        ];
        
        for (const endpoint of otherEndpoints) {
            console.log(`\n📍 ${endpoint}`);
            const res = await axios.get(`${BASE_URL}/${endpoint}`, apiConfig);
            console.log('   Status:', res.status);
            if (res.status === 200) {
                console.log('   Data:', JSON.stringify(res.data, null, 2).substring(0, 500));
            }
        }
        
    } catch (error) {
        console.error('\n❌ Error:', error.message);
        if (error.response) {
            console.error('Response:', error.response.status, error.response.data);
        }
    }
}

testReg3APIs();
