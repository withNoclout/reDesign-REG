const axios = require('axios');
const https = require('https');

require('dotenv').config({ path: '.env.local' });

const agent = new https.Agent({ rejectUnauthorized: false });

async function testDiscoveredAPIs() {
    console.log('1. Logging in to get token...');
    const loginRes = await axios.post('http://localhost:3000/api/auth/login', {
        username: process.env.REG_USERNAME,
        password: process.env.REG_PASSWORD
    });

    const cookies = loginRes.headers['set-cookie'];
    const regTokenCookie = cookies.find(c => c.startsWith('reg_token='));
    const token = regTokenCookie ? regTokenCookie.split(';')[0].split('=')[1] : null;

    if (!token) throw new Error('Failed to get token');

    const headers = { 'Authorization': `Bearer ${token}` };

    // Test the discovered endpoints across possible base URLs
    const baseUrls = [
        'https://reg2.kmutnb.ac.th/registrar/api/th',
        'https://reg2.kmutnb.ac.th/regapiweb/api/th',
        'https://reg2.kmutnb.ac.th/regapiweb2/api/th',
        'https://reg3.kmutnb.ac.th/regapiweb1/api/th',
        'https://reg4.kmutnb.ac.th/regapiweb2/api/th',
    ];

    // Evaluateofficer is the list page API based on the chunks
    // Let's try to get the list of evaluations for the student
    const endpoints = [
        '/Evaluateofficer',
        '/Evaluateofficer/Getall',
        '/Evaluateofficerform/Evaluategroup/125'
    ];

    console.log('\n2. Testing endpoints...');
    for (const base of baseUrls) {
        console.log(`\nBase: ${base}`);
        for (const ep of endpoints) {
            try {
                const url = base + ep;
                const res = await axios.get(url, { headers, httpsAgent: agent, validateStatus: () => true, timeout: 5000 });
                console.log(`  [${res.status}] ${ep}`);
                if (res.status === 200) {
                    console.log(`      Found it! ${url}`);
                }
            } catch (e) {
                console.log(`  [ERR] ${ep} - ${e.message}`);
            }
        }
    }
}

testDiscoveredAPIs().catch(console.error);
