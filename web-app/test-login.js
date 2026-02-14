const axios = require('axios');

async function testLogin(username, password) {
    const BASE_URL = 'https://reg4.kmutnb.ac.th/regapiweb2/api/th';
    console.log(`[TEST] Testing login for user: ${username}`);

    try {
        // Step 1: Token Service
        console.log('[TEST] 1. Calling tokenservice...');
        const tokenResponse = await axios.get(`${BASE_URL}/Validate/tokenservice`);
        console.log('[TEST] Token Service Status:', tokenResponse.status);

        const token = tokenResponse.data.token;
        console.log('[TEST] Extracted Token:', token ? token.substring(0, 20) + '...' : 'NONE');

        if (!token) {
            console.error('[TEST] No token found in tokenservice response. Aborting.');
            return;
        }

        // Attempt 1: Authorization Header
        console.log('\n[TEST] Attempt 1: Authorization: Bearer <TOKEN>');
        try {
            const res1 = await axios.post(`${BASE_URL}/Account/LoginAD`,
                { username, password },
                {
                    headers: { 'Authorization': `Bearer ${token}` },
                    validateStatus: () => true
                }
            );
            console.log('[TEST] Status:', res1.status);
            if (res1.status === 200) console.log('!!! SUCCESS !!!');
        } catch (e) { console.log('Error:', e.message); }

        // Attempt 2: Custom 'token' Header
        console.log('\n[TEST] Attempt 2: Header "token": <TOKEN>');
        try {
            const res2 = await axios.post(`${BASE_URL}/Account/LoginAD`,
                { username, password },
                {
                    headers: { 'token': token },
                    validateStatus: () => true
                }
            );
            console.log('[TEST] Status:', res2.status);
            if (res2.status === 200) console.log('!!! SUCCESS !!!');
        } catch (e) { console.log('Error:', e.message); }

        // Attempt 3: Payload 'token'
        console.log('\n[TEST] Attempt 3: Payload { token, username, password }');
        try {
            const res3 = await axios.post(`${BASE_URL}/Account/LoginAD`,
                { username, password, token },
                { validateStatus: () => true }
            );
            console.log('[TEST] Status:', res3.status);
            if (res3.status === 200) console.log('!!! SUCCESS !!!');
        } catch (e) { console.log('Error:', e.message); }

        // Attempt 4: Payload 'user' instead of 'username'
        console.log('\n[TEST] Attempt 4: user/pass Payload');
        try {
            const res4 = await axios.post(`${BASE_URL}/Account/LoginAD`,
                { user: username, pass: password, token }, // user/pass
                { validateStatus: () => true }
            );
            console.log('[TEST] Status:', res4.status);
            // console.log(res4.data);
            if (res4.status === 200) console.log('!!! SUCCESS !!!');
        } catch (e) { console.log('Error:', e.message); }

        // Attempt 5: RequestVerificationToken Header
        console.log('\n[TEST] Attempt 5: Header "RequestVerificationToken": <TOKEN>');
        try {
            const res5 = await axios.post(`${BASE_URL}/Account/LoginAD`,
                { username, password },
                {
                    headers: { 'RequestVerificationToken': token },
                    validateStatus: () => true
                }
            );
            console.log('[TEST] Status:', res5.status);
            if (res5.status === 200) console.log('!!! SUCCESS !!!');
        } catch (e) { console.log('Error:', e.message); }

        // Attempt 6: Cookie 'token=<TOKEN>'
        console.log('\n[TEST] Attempt 6: Cookie "token=<TOKEN>"');
        try {
            const res6 = await axios.post(`${BASE_URL}/Account/LoginAD`,
                { username, password },
                {
                    headers: { 'Cookie': `token=${token}` },
                    validateStatus: () => true
                }
            );
            console.log('[TEST] Status:', res6.status);
            if (res6.status === 200) console.log('!!! SUCCESS !!!');
        } catch (e) { console.log('Error:', e.message); }

        // Attempt 7: Cookie 'authorization=<TOKEN>'
        console.log('\n[TEST] Attempt 7: Cookie "authorization=<TOKEN>"');
        try {
            const res7 = await axios.post(`${BASE_URL}/Account/LoginAD`,
                { username, password },
                {
                    headers: { 'Cookie': `authorization=${token}` },
                    validateStatus: () => true
                }
            );
            console.log('[TEST] Status:', res7.status);
            if (res7.status === 200) console.log('!!! SUCCESS !!!');
        } catch (e) { console.log('Error:', e.message); }

        // Attempt 8: Payload with IP
        console.log('\n[TEST] Attempt 8: Payload with IP');
        try {
            const res8 = await axios.post(`${BASE_URL}/Account/LoginAD`,
                { username, password, ip: '127.0.0.1' }, // sending localhost IP
                {
                    headers: { 'token': token },
                    validateStatus: () => true
                }
            );
            console.log('[TEST] Status:', res8.status);
            if (res8.status === 200) console.log('!!! SUCCESS !!!');
        } catch (e) { console.log('Error:', e.message); }

        // Attempt 9: Form Data (x-www-form-urlencoded)
        console.log('\n[TEST] Attempt 9: x-www-form-urlencoded');
        const params = new URLSearchParams();
        params.append('username', username);
        params.append('password', password);
        // params.append('token', token); // Try without token first inside body, but assume header
        try {
            const res9 = await axios.post(`${BASE_URL}/Account/LoginAD`,
                params,
                {
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                        'token': token
                    },
                    validateStatus: () => true
                }
            );
            console.log('[TEST] Status:', res9.status);
            if (res9.status === 200) console.log('!!! SUCCESS !!!');
        } catch (e) { console.log('Error:', e.message); }

        // Attempt 10: /Account/Login (Not AD)
        console.log('\n[TEST] Attempt 10: /Account/Login Endpoint');
        try {
            const res10 = await axios.post(`${BASE_URL}/Account/Login`,
                { username, password },
                {
                    headers: { 'token': token },
                    validateStatus: () => true
                }
            );
            console.log('[TEST] Status:', res10.status);
            if (res10.status === 200) console.log('!!! SUCCESS !!!');
        } catch (e) { console.log('Error:', e.message); }

    } catch (error) {
        console.error('[TEST] ERROR:', error.message);
        if (error.response) {
            console.error('[TEST] Response Status:', error.response.status);
            console.error('[TEST] Response Data:', error.response.data);
        }
    }
}

// Get args from command line or default
const user = process.argv[2] || 's6701091611290';
const pass = process.argv[3] || '035037603za'; // User provided this earlier

testLogin(user, pass);
