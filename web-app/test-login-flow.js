const axios = require('axios');

const BASE_URL = 'http://localhost:3000';
const USERNAME = 's6701091611290';
const PASSWORD = '035037603za';

async function runTest() {
    console.log('=== Starting Login Flow Test ===');
    console.log(`Testing with user: ${USERNAME}`);

    try {
        // Step 1: Attempt Login
        console.log('\n[TEST] 1. POST /api/auth/login');
        const loginResponse = await axios.post(`${BASE_URL}/api/auth/login`, {
            username: USERNAME,
            password: PASSWORD
        }, {
            validateStatus: () => true // Allow non-2xx status codes
        });

        console.log(`[TEST] Login Status: ${loginResponse.status}`);
        console.log('[TEST] Login Response Data:', JSON.stringify(loginResponse.data, null, 2));
        
        if (loginResponse.status !== 200) {
            console.error('[TEST] Login Failed!');
            console.error('[TEST] Response:', JSON.stringify(loginResponse.data, null, 2));
            return;
        }

        console.log('[TEST] Login Successful!');
        
        // Extract Cookies
        const cookies = loginResponse.headers['set-cookie'];
        if (!cookies || cookies.length === 0) {
            console.error('[TEST] No cookies received!');
            return;
        }

        console.log('[TEST] Cookies received:', cookies.map(c => c.split(';')[0]));
        
        // Construct Cookie Header
        const cookieHeader = cookies.map(c => c.split(';')[0]).join('; ');

        // Step 2: Access Protected Route
        console.log('\n[TEST] 2. GET /api/student/profile (with cookie)');
        const infoResponse = await axios.get(`${BASE_URL}/api/student/profile`, {
            headers: {
                'Cookie': cookieHeader
            },
            validateStatus: () => true
        });

        console.log(`[TEST] Info Status: ${infoResponse.status}`);
        
        if (infoResponse.status === 200) {
            console.log('[TEST] Access Successful!');
            console.log('[TEST] Full Response Data:', JSON.stringify(infoResponse.data, null, 2));
            console.log('[TEST] Student Name:', infoResponse.data.data?.name || 'Unknown');
            console.log('[TEST] RESULT: User remains logged in (Cookie valid).');
        } else {
            console.error('[TEST] Access Failed!');
            console.error('[TEST] Response:', JSON.stringify(infoResponse.data, null, 2));
            console.error('[TEST] RESULT: Relocated/Rejected (Cookie invalid).');
        }

    } catch (error) {
        console.error('[TEST] Unexpected Error:', error.message);
        if (error.response) {
            console.error('[TEST] Response Data:', error.response.data);
        }
    }
}

runTest();
