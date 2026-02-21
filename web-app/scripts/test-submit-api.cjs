const axios = require('axios');
const https = require('https');
const zlib = require('zlib');
const { promisify } = require('util');
require('dotenv').config({ path: '.env.local' });

const agent = new https.Agent({ rejectUnauthorized: false });

async function testSubmitAPI() {
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

        const classid = '304224';
        const evaluateid = '125';
        const officerid = '2852';

        // 1. Fetch questions first to know what to answer
        const getUrl = `https://reg3.kmutnb.ac.th/regapiweb1/api/th/Evaluateofficerform/Evaluatequestion/${classid}/${evaluateid}/${officerid}`;
        console.log(`Fetching questions...`);
        const qRes = await axios.get(getUrl, { headers, httpsAgent: agent });

        let questions = [];
        if (qRes.data?.result) {
            const decompressed = await promisify(zlib.gunzip)(Buffer.from(qRes.data.result, 'base64'));
            questions = JSON.parse(decompressed.toString('utf-8'));
        }

        // 2. Build answer payload like Angular's this.frm.value
        // Format: { Q220: "5", Q221: "5" }
        const payload = {};
        questions.forEach(q => {
            if (q.questiontype !== 'H') {
                payload[q.questiontype + q.questionid] = '5'; // Max rating
            } else {
                payload[q.questiontype + q.questionid] = 'สอนดีมากครับ'; // For text areas
            }
        });

        console.log('Payload:', payload);

        // 3. Addanswer
        const addUrl = `https://reg3.kmutnb.ac.th/regapiweb1/api/th/Evaluateofficerform/Addanswer/${evaluateid}/${classid}/${officerid}/1`;
        console.log(`\nPOST to Addanswer...`);
        const addRes = await axios.post(addUrl, payload, { headers, httpsAgent: agent, validateStatus: () => true });
        console.log(`Addanswer status: ${addRes.status}`);
        console.log(addRes.data);

        // Do we commit? Let's just Addanswer first, it might not finalize it, so we can test it a few times.
        // If we want to fully commit, uncomment the next block.

        /*
        const commitUrl = `https://reg3.kmutnb.ac.th/regapiweb1/api/th/Evaluateofficerform/commit/${evaluateid}/${classid}/${officerid}`;
        console.log(`\nPOST to commit...`);
        const commitRes = await axios.post(commitUrl, {}, { headers, httpsAgent: agent, validateStatus: () => true });
        console.log(`Commit status: ${commitRes.status}`);
        */

    } catch (e) {
        console.error(e.message);
    }
}
testSubmitAPI();
