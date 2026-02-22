const axios = require('axios');
const https = require('https');
const zlib = require('zlib');
require('dotenv').config({ path: '.env.local' });

const agent = new https.Agent({ rejectUnauthorized: false });

async function testReg2RegapiwebAddanswer() {
    try {
        const loginRes = await axios.post('http://localhost:3000/api/auth/login', {
            username: process.env.REG_USERNAME,
            password: process.env.REG_PASSWORD
        });
        const token = loginRes.headers['set-cookie'].find(c => c.startsWith('reg_token=')).split(';')[0].split('=')[1];
        const headers = { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };

        const classid = '305594';
        const evaluateid = '125';
        const officerid = '2795';

        // Get the questions first
        const qUrl = `https://reg3.kmutnb.ac.th/regapiweb1/api/th/Evaluateofficerform/Evaluatequestion/${classid}/${evaluateid}/${officerid}`;
        const qRes = await axios.get(qUrl, { headers, httpsAgent: agent });
        const questions = JSON.parse(zlib.gunzipSync(Buffer.from(qRes.data.result, 'base64')).toString());

        // Build payload
        const payload = {};
        questions.forEach(q => {
            if (q.questiontype === 'H') return;
            if (q.questiontype === 'Q') {
                payload[q.questiontype + '' + q.questionid] = '5';
            } else if (q.questiontype === 'C') {
                payload[q.questiontype + '' + q.questionid] = q.description || '';
            }
        });
        payload['Ctxt'] = 'สอนดีมากครับ';
        payload['complaints'] = '';

        // Try all servers from reg2
        const servers = [
            'https://reg2.kmutnb.ac.th/regapiweb1/api/th',
            'https://reg2.kmutnb.ac.th/regapiweb2/api/th',
            'https://reg2.kmutnb.ac.th/regapiweb3/api/th',
        ];

        for (const server of servers) {
            const addUrl = `${server}/Evaluateofficerform/Addanswer/${evaluateid}/${classid}/${officerid}/1`;
            console.log(`POST ${addUrl}`);
            try {
                const addRes = await axios.post(addUrl, payload, { headers, httpsAgent: agent, validateStatus: () => true, timeout: 5000 });
                console.log(`  Status: ${addRes.status}`);
                if (addRes.status === 200) {
                    console.log('  ✅ SUCCESS:', JSON.stringify(addRes.data));
                } else {
                    console.log('  Response:', typeof addRes.data === 'string' ? addRes.data.substring(0, 80) : JSON.stringify(addRes.data));
                }
            } catch (e) {
                console.log('  Error:', e.message);
            }
        }

    } catch (e) {
        console.error(e.message);
    }
}

testReg2RegapiwebAddanswer();
