const axios = require('axios');
const https = require('https');
require('dotenv').config({ path: '.env.local' });

const agent = new https.Agent({ rejectUnauthorized: false });

async function testApiBody() {
    try {
        console.log('Logging in...');
        const loginRes = await axios.post('http://localhost:3000/api/auth/login', {
            username: process.env.REG_USERNAME,
            password: process.env.REG_PASSWORD
        });

        const cookies = loginRes.headers['set-cookie'];
        const regTokenCookie = cookies.find(c => c.startsWith('reg_token='));
        const token = regTokenCookie ? regTokenCookie.split(';')[0].split('=')[1] : null;

        if (!token) throw new Error('No token');

        const headers = { 'Authorization': `Bearer ${token}` };

        // Test the reg4 endpoint which we know is stable for other things
        const urls = [
            'https://reg3.kmutnb.ac.th/regapiweb1/api/th/Evaluateofficerform/Evaluategroup/125',
            'https://reg4.kmutnb.ac.th/regapiweb2/api/th/Evaluateofficerform/Evaluategroup/125'
        ];

        for (const url of urls) {
            console.log(`\nTesting ${url}...`);
            try {
                const res = await axios.get(url, { headers, httpsAgent: agent, validateStatus: () => true, timeout: 5000 });
                console.log(`Status: ${res.status}`);
                if (res.data) {
                    if (res.data.result) { console.log('Base64 result found'); }
                    else if (typeof res.data === 'string') {
                        console.log('HTML returned:', res.data.substring(0, 100).replace(/\n/g, ' '));
                    } else {
                        console.log('JSON returned:', JSON.stringify(res.data).substring(0, 200));
                    }
                }
            } catch (e) {
                console.log('Error:', e.message);
            }
        }

        console.log('\nTesting the list endpoint...');
        // Let's try to find the list of evaluations to see where we get the evaluateid etc.
        const listUrls = [
            'https://reg3.kmutnb.ac.th/regapiweb1/api/th/Evaluateofficer/Getall',
            'https://reg4.kmutnb.ac.th/regapiweb2/api/th/Evaluateofficer/Getall'
        ];

        for (const url of listUrls) {
            console.log(`\nTesting ${url}...`);
            try {
                const res = await axios.get(url, { headers, httpsAgent: agent, validateStatus: () => true, timeout: 5000 });
                console.log(`Status: ${res.status}`);
                if (typeof res.data === 'string') {
                    console.log('HTML returned');
                } else if (res.data?.result) {
                    console.log('Base64 result found');
                } else {
                    console.log('JSON returned:', JSON.stringify(res.data).substring(0, 500));
                }
            } catch (e) { console.log('Error:', e.message); }
        }

    } catch (e) {
        console.error(e.message);
    }
}
testApiBody();
