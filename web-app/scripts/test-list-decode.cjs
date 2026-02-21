const axios = require('axios');
const https = require('https');
const zlib = require('zlib');
const { promisify } = require('util');
require('dotenv').config({ path: '.env.local' });

const gunzip = promisify(zlib.gunzip);
const agent = new https.Agent({ rejectUnauthorized: false });

async function decodeListAPI() {
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

        const url = 'https://reg3.kmutnb.ac.th/regapiweb1/api/th/Evaluateofficer/Class';
        console.log(`\nFetching ${url}...`);

        const res = await axios.get(url, { headers, httpsAgent: agent });

        if (res.data && res.data.result) {
            console.log('Decoding Base64 + Gzip payload...');
            const compressed = Buffer.from(res.data.result, 'base64');
            const decompressed = await gunzip(compressed);
            const parsed = JSON.parse(decompressed.toString('utf-8'));

            console.log('\nDecoded JSON Structure (First Item):');
            console.log(JSON.stringify(parsed[0], null, 2));

            console.log(`\nTotal items: ${parsed.length}`);

            // Show a summary of all items
            console.log('\nSummary:');
            parsed.forEach((item, i) => {
                const statusStr = item.evaluatestatus ? '✅ Evaluated' : '❌ Pending';
                console.log(`[${i}] ${item.coursecode} Sec ${item.sectioncode} | ${item.coursename} | ${item.officername} | evaluateid: ${item.evaluateid} | classid: ${item.classid} | Status: ${statusStr}`);
            });

        } else {
            console.log('No result field found.');
        }

    } catch (e) {
        console.error(e.message);
    }
}
decodeListAPI();
