const axios = require('axios');
const https = require('https');
require('dotenv').config({ path: '.env.local' });

const agent = new https.Agent({ rejectUnauthorized: false });

async function findListAPI() {
    try {
        console.log('Logging in...');
        const loginRes = await axios.post('http://localhost:3000/api/auth/login', {
            username: process.env.REG_USERNAME,
            password: process.env.REG_PASSWORD
        });

        const cookies = loginRes.headers['set-cookie'];
        const regTokenCookie = cookies.find(c => c.startsWith('reg_token='));
        const token = regTokenCookie ? regTokenCookie.split(';')[0].split('=')[1] : null;

        const headers = { 'Authorization': `Bearer ${token}` };

        // We found Evaluateofficer/Class, let's test it on reg3 and reg4
        const urls = [
            'https://reg3.kmutnb.ac.th/regapiweb1/api/th/Evaluateofficer/Class',
            'https://reg4.kmutnb.ac.th/regapiweb2/api/th/Evaluateofficer/Class'
        ];

        for (const url of urls) {
            console.log(`\nTesting ${url}...`);
            try {
                const res = await axios.get(url, { headers, httpsAgent: agent, validateStatus: () => true });
                console.log(`Status: ${res.status}`);
                if (res.status === 200) {
                    console.log('JSON returned:', JSON.stringify(res.data, null, 2).substring(0, 1000));
                }
            } catch (e) { console.log('Error:', e.message); }
        }

    } catch (e) {
        console.error(e.message);
    }
}
findListAPI();
