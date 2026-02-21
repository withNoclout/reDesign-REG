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

        if (!token) throw new Error('No token');

        const headers = { 'Authorization': `Bearer ${token}` };

        // Test potential list endpoints across reg3 and reg4
        const servers = [
            'https://reg3.kmutnb.ac.th/regapiweb1/api/th',
            'https://reg4.kmutnb.ac.th/regapiweb2/api/th'
        ];

        // These are common patterns in KMUTNB reg systems based on the JS bundle
        const endpoints = [
            '/Evaluateofficer/Getall',
            '/Evaluateofficer',
            '/Evaluateofficer/Getlist',
            '/Evaluateofficer/List',
            '/Evaluateofficer/Header',
            '/Evaluateofficer/GetHead',
            '/Evaluateofficerform/Getall',
            '/Evaluateofficerform',
            '/Evaluateofficerform/List',
            '/Evaluate/Getall'
        ];

        for (const server of servers) {
            console.log(`\n\n=== Testing Server: ${server} ===`);
            for (const ep of endpoints) {
                const url = server + ep;
                try {
                    const res = await axios.get(url, { headers, httpsAgent: agent, validateStatus: () => true, timeout: 3000 });
                    if (res.status === 200) {
                        console.log(`✅ [200] ${ep}`);
                        // Preview data
                        const preview = typeof res.data === 'string' ? res.data.substring(0, 50) : JSON.stringify(res.data).substring(0, 100);
                        console.log(`   Data: ${preview}`);
                    } else if (res.status !== 404 && res.status !== 500) {
                        console.log(`⚠️ [${res.status}] ${ep}`);
                    } else {
                        // Suppress 404/500 to reduce noise
                        // process.stdout.write('.');
                    }
                } catch (e) { /* suppress timeouts */ }
            }
        }

        // Also try with typical parameters like term and year
        console.log('\n\n=== Testing with term/year parameters ===');
        const termParams = '/2568/2'; // Current term
        for (const server of servers) {
            for (const ep of endpoints) {
                const url = server + ep + termParams;
                try {
                    const res = await axios.get(url, { headers, httpsAgent: agent, validateStatus: () => true, timeout: 3000 });
                    if (res.status === 200) {
                        console.log(`✅ [200] ${ep}${termParams}`);
                    }
                } catch (e) { }
            }
        }

    } catch (e) {
        console.error(e.message);
    }
}
findListAPI();
