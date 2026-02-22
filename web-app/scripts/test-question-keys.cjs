// Script to dump the exact raw JSON from the reg2 Evaluatequestion API
// Run with: node scripts/test-question-keys.cjs
require('dotenv').config({ path: '.env.local' });
const axios = require('axios');
const https = require('https');
const zlib = require('zlib');
const { promisify } = require('util');
const gunzip = promisify(zlib.gunzip);
const { encryptForReg } = require('../lib/regCipherUtils');

const agent = new https.Agent({ rejectUnauthorized: false });
const LOGIN_BASE_URL = 'https://reg4.kmutnb.ac.th/regapiweb2/api/th';
const CLASS_URL = 'https://reg3.kmutnb.ac.th/regapiweb1/api/th';
const REG2_BASE_URL = 'https://reg2.kmutnb.ac.th/regapiweb3/api/th';

async function main() {
    // 1. Login
    const serviceTokenResp = await axios.get(`${LOGIN_BASE_URL}/Validate/tokenservice`, { httpsAgent: agent });
    const serviceToken = serviceTokenResp.data.token;
    const credJson = JSON.stringify({ username: process.env.REG_USERNAME, password: process.env.REG_PASSWORD, ip: '' });
    const loginResp = await axios.post(`${LOGIN_BASE_URL}/Account/LoginAD`, { param: encryptForReg(credJson) }, {
        headers: { 'Authorization': `Bearer ${serviceToken}` },
        httpsAgent: agent
    });
    const token = loginResp.data.token;

    // 2. Get class list
    const classResp = await axios.get(`${CLASS_URL}/Evaluateofficer/Class`, {
        headers: { 'Authorization': `Bearer ${token}` },
        httpsAgent: agent
    });
    const courses = JSON.parse((await gunzip(Buffer.from(classResp.data.result, 'base64'))).toString('utf-8'));

    // 3. Find first pending evaluation
    for (const course of courses) {
        if (!course.instructor) continue;
        for (const inst of course.instructor) {
            if (inst.evaluatestatus === 0 || inst.evaluatestatus === '0') {
                console.log(`\nFound pending: ${inst.officername}`);
                console.log(`classid: ${course.classid}, evaluateid: ${inst.evaluateid}, officerid: ${inst.officerid}`);

                const url = `${REG2_BASE_URL}/Evaluateofficerform/Evaluatequestion/${course.classid}/${inst.evaluateid}/${inst.officerid}`;
                console.log(`Fetching: ${url}\n`);

                const qResp = await axios.get(url, {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                    },
                    httpsAgent: agent,
                    timeout: 10000
                });

                let rawData = qResp.data;
                if (rawData && rawData.result) {
                    rawData = JSON.parse((await gunzip(Buffer.from(rawData.result, 'base64'))).toString('utf-8'));
                }

                if (Array.isArray(rawData) && rawData.length > 0) {
                    console.log('Total questions:', rawData.length);
                    console.log('\n--- Object Keys of 1st Question ---');
                    console.log(Object.keys(rawData[0]));
                    console.log('\n--- Full JSON of 1st Question ---');
                    console.log(JSON.stringify(rawData[0], null, 2));
                    console.log('\n--- Full JSON of ALL Questions ---');
                    rawData.forEach((q, i) => {
                        console.log(`[${i + 1}]`, JSON.stringify(q));
                    });
                } else {
                    console.log('Raw response:', JSON.stringify(rawData, null, 2));
                }
                process.exit(0);
            }
        }
    }
    console.log('No pending evaluations found.');
}

main().catch(e => {
    console.error('\n--- ERROR ---');
    console.error(e.response ? `HTTP ${e.response.status}: ${JSON.stringify(e.response.data)}` : e.message);
    process.exit(1);
});
