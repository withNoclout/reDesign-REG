const axios = require('axios');
const https = require('https');
const zlib = require('zlib');
const { promisify } = require('util');
require('dotenv').config({ path: '.env.local' });

const gunzip = promisify(zlib.gunzip);
const agent = new https.Agent({ rejectUnauthorized: false });

async function testFormAPI() {
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

        // We know these values from test-list-decode:
        // classid: 304224, evaluateid: 125, officerid: 2852
        const classid = '304224';
        const evaluateid = '125';
        const officerid = '2852';

        const url = `https://reg3.kmutnb.ac.th/regapiweb1/api/th/Evaluateofficerform/Evaluatequestion/${classid}/${evaluateid}/${officerid}`;

        console.log(`\nFetching ${url}...`);
        const res = await axios.get(url, { headers, httpsAgent: agent, validateStatus: () => true });

        if (res.status === 200 && res.data?.result) {
            const compressed = Buffer.from(res.data.result, 'base64');
            const decompressed = await gunzip(compressed);
            const parsed = JSON.parse(decompressed.toString('utf-8'));

            console.log('\nDecoded JSON Structure:');
            console.log(JSON.stringify(parsed[0], null, 2));

            console.log(`\nTotal questions: ${parsed.length}`);

            // Wait, there might be multiple groups of questions. Let's see all unique group names.
            const groups = [...new Set(parsed.map(p => p.evaluategroupdes))];
            console.log('Groups:', groups);

            // Check the choices format
            if (parsed[0].evaluatechoice) {
                console.log('\nChoices for Q1:');
                console.log(JSON.stringify(parsed[0].evaluatechoice, null, 2));
            }

        } else {
            console.log(`Status: ${res.status}`);
            console.log(res.data);
        }

    } catch (e) {
        console.error(e.message);
    }
}
testFormAPI();
