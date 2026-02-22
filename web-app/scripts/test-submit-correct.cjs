const axios = require('axios');
const https = require('https');
const zlib = require('zlib');
const { promisify } = require('util');
require('dotenv').config({ path: '.env.local' });

const gunzip = promisify(zlib.gunzip);
const agent = new https.Agent({ rejectUnauthorized: false });

async function testCorrectPayload() {
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

        // 1. Get questions to build exact form
        const qUrl = `https://reg3.kmutnb.ac.th/regapiweb1/api/th/Evaluateofficerform/Evaluatequestion/${classid}/${evaluateid}/${officerid}`;
        const qRes = await axios.get(qUrl, { headers, httpsAgent: agent });
        const decompressed = zlib.gunzipSync(Buffer.from(qRes.data.result, 'base64')).toString();
        const questions = JSON.parse(decompressed);

        // 2. Build payload EXACTLY like Angular's generateform + frm.value
        // From the code: 
        //   "Q" type → o[c.questiontype+""+c.questionid] = FormControl(value: c.choiceid)  → key: "Q220", value: "5"
        //   "C" type → o[c.questiontype+""+c.questionid] = FormControl(value: c.description) → key: "C228", value: "..."  
        //   "H" type → skipped ("H"!=c.questiontype)
        //   "M" type → o[c.questiontype+""+c.questionid+u.choiceid] → key: "M228a", value: true/false
        //   At the end: o.Ctxt = FormControl(value: t[0]?.feedback)
        //   o.complaints = FormControl(value: t[0]?.complaints)

        const payload = {};

        questions.forEach(q => {
            if (q.questiontype === 'H') return; // Skip headers

            if (q.questiontype === 'Q') {
                // Standard question - set to 5 (max)
                payload[q.questiontype + '' + q.questionid] = '5';
            } else if (q.questiontype === 'C') {
                // Comment/description
                payload[q.questiontype + '' + q.questionid] = q.description || '';
            } else if (q.questiontype === 'M') {
                // Multi-choice
                if (q.evaluatechoice) {
                    q.evaluatechoice.forEach(choice => {
                        payload[q.questiontype + '' + q.questionid + choice.choiceid] = choice.check || false;
                        if (choice.choicetype === 'T') {
                            payload[q.questiontype + '' + q.questionid + choice.choiceid + 'txt'] = choice.chkdescription || '';
                        }
                    });
                }
            }
        });

        // Add feedback and complaints fields
        payload['Ctxt'] = questions[0]?.feedback || 'สอนดีครับ';
        payload['complaints'] = questions[0]?.complaints || '';

        console.log('Payload:', JSON.stringify(payload, null, 2));
        console.log('\nPayload keys:', Object.keys(payload).join(', '));

        // 3. POST to Addanswer
        const addUrl = `https://reg3.kmutnb.ac.th/regapiweb1/api/th/Evaluateofficerform/Addanswer/${evaluateid}/${classid}/${officerid}/1`;
        console.log(`\nPOST to ${addUrl}`);
        const addRes = await axios.post(addUrl, payload, { headers, httpsAgent: agent, validateStatus: () => true });
        console.log(`Status: ${addRes.status}`);
        console.log('Response:', JSON.stringify(addRes.data));

    } catch (e) {
        console.error(e.message);
    }
}

testCorrectPayload();
