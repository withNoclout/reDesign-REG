const axios = require('axios');
const https = require('https');
const zlib = require('zlib');
require('dotenv').config({ path: '.env.local' });

const agent = new https.Agent({ rejectUnauthorized: false });

async function exactSubmit() {
    try {
        const loginRes = await axios.post('http://localhost:3000/api/auth/login', {
            username: process.env.REG_USERNAME,
            password: process.env.REG_PASSWORD
        });
        const token = loginRes.headers['set-cookie'].find(c => c.startsWith('reg_token=')).split(';')[0].split('=')[1];
        const headers = { 'Authorization': `Bearer ${token}` };

        const classid = '304224';
        const evaluateid = '125';
        const officerid = '2852';

        const qUrl = `https://reg3.kmutnb.ac.th/regapiweb1/api/th/Evaluateofficerform/Evaluatequestion/${classid}/${evaluateid}/${officerid}`;
        const qRes = await axios.get(qUrl, { headers, httpsAgent: agent });
        const decompressed = require('zlib').gunzipSync(Buffer.from(qRes.data.result, 'base64')).toString();
        const questions = JSON.parse(decompressed);

        const payload = {};
        for (const q of questions) {
            // It gets the choiceid or empty string
            if (q.questiontype === 'Q') {
                payload['Q' + q.questionid] = '5';
            } else if (q.questiontype === 'H') {
                // Not bound? In angular: `"H"!=c.questiontype`
            }
        }

        console.log('Sending exact payload keys:', Object.keys(payload).join(', '));

        const addUrl = `https://reg3.kmutnb.ac.th/regapiweb1/api/th/Evaluateofficerform/Addanswer/${evaluateid}/${classid}/${officerid}/1`;
        const addRes = await axios.post(addUrl, payload, { headers, httpsAgent: agent, validateStatus: () => true });
        console.log(addRes.status, JSON.stringify(addRes.data));

    } catch (e) {
        console.error(e.message);
    }
}
exactSubmit();
