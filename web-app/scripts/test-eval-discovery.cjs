const axios = require('axios');
const https = require('https');
const zlib = require('zlib');
const { promisify } = require('util');
const gunzip = promisify(zlib.gunzip);

require('dotenv').config({ path: '.env.local' });

const agent = new https.Agent({ rejectUnauthorized: false });

async function testEvalAPIs() {
    try {
        // 1. Login to get token
        console.log('1. Logging in...');
        const loginRes = await axios.post('http://localhost:3000/api/auth/login', {
            username: process.env.REG_USERNAME,
            password: process.env.REG_PASSWORD
        });

        const cookies = loginRes.headers['set-cookie'];
        const regTokenCookie = cookies.find(c => c.startsWith('reg_token='));
        const token = regTokenCookie ? regTokenCookie.split(';')[0].split('=')[1] : null;
        if (!token) throw new Error('Failed to get token');
        console.log('   Token:', token.substring(0, 30) + '...');

        const headers = { 'Authorization': `Bearer ${token}` };

        // 2. Try to find evaluation list first (no evaluateid)
        console.log('\n2. Searching for evaluation list endpoints...');

        const baseURLs = [
            'https://reg1.kmutnb.ac.th/regapiweb3/api/th',
            'https://reg3.kmutnb.ac.th/regapiweb1/api/th',
            'https://reg4.kmutnb.ac.th/regapiweb2/api/th',
        ];

        const evalPaths = [
            '/Evaluateofficer',
            '/Evaluateofficer/GetList',
            '/Evaluateofficer/List',
            '/Evaluateofficer/GetHead',
            '/Evaluateofficer/GetItem',
            '/Evaluateofficer/Index',
            '/Evaluate',
            '/Evaluate/List',
            '/Evaluate/GetList',
            '/EvaluateOfficer',
            '/EvaluateOfficer/GetList',
        ];

        for (const base of baseURLs) {
            console.log(`\n--- Testing ${base} ---`);
            for (const path of evalPaths) {
                const url = base + path;
                try {
                    const res = await axios.get(url, {
                        headers,
                        httpsAgent: agent,
                        validateStatus: s => true,
                        timeout: 5000
                    });
                    if (res.status === 200) {
                        console.log(`  ✅ ${path} → ${res.status}`);
                        // Try to decode if gzipped
                        if (res.data?.result) {
                            try {
                                const decompressed = await gunzip(Buffer.from(res.data.result, 'base64'));
                                const parsed = JSON.parse(decompressed.toString('utf-8'));
                                console.log('     Data:', JSON.stringify(parsed).substring(0, 300));
                            } catch {
                                console.log('     Raw:', JSON.stringify(res.data).substring(0, 300));
                            }
                        } else {
                            console.log('     Data:', JSON.stringify(res.data).substring(0, 300));
                        }
                    } else {
                        process.stdout.write(`  ❌ ${path} → ${res.status}\n`);
                    }
                } catch (e) {
                    process.stdout.write(`  ❌ ${path} → ${e.message}\n`);
                }
            }
        }

        // 3. Also try the reg2 Angular API
        console.log('\n\n3. Testing reg2 Angular API patterns...');
        const reg2Paths = [
            '/api/login',
            '/api/auth/login',
            '/api/th/login',
            '/api/evaluateofficer',
            '/api/evaluate',
            '/registrar/api/login',
            '/registrar/api/evaluateofficer',
        ];

        for (const path of reg2Paths) {
            const url = 'https://reg2.kmutnb.ac.th' + path;
            try {
                const res = await axios.get(url, {
                    httpsAgent: agent,
                    validateStatus: s => true,
                    timeout: 5000,
                    headers
                });
                if (res.status !== 404 && res.status !== 405) {
                    console.log(`  ✅ ${path} → ${res.status}`);
                    console.log('     Data:', JSON.stringify(res.data).substring(0, 200));
                } else {
                    console.log(`  ❌ ${path} → ${res.status}`);
                }
            } catch (e) {
                console.log(`  ❌ ${path} → ${e.message}`);
            }
        }

    } catch (e) {
        console.error('Error:', e.message);
    }
}

testEvalAPIs();
