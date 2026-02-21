const axios = require('axios');
const https = require('https');
require('dotenv').config({ path: '.env.local' });
const agent = new https.Agent({ rejectUnauthorized: false });

async function findWorkingPayload() {
    const loginRes = await axios.post('http://localhost:3000/api/auth/login', { username: process.env.REG_USERNAME, password: process.env.REG_PASSWORD });
    const token = loginRes.headers['set-cookie'].find(c => c.startsWith('reg_token=')).split(';')[0].split('=')[1];
    const headers = { 'Authorization': `Bearer ${token}` };

    const evaluateid = '125', classid = '304224', officerid = '2852';
    const url = 'https://reg3.kmutnb.ac.th/regapiweb1/api/th/Evaluateofficerform/Addanswer/' + evaluateid + '/' + classid + '/' + officerid + '/1';

    const payloadsToTest = [
        { payload: { Q220: '5', Q221: '5' }, name: 'Object' },
        { payload: JSON.stringify({ Q220: '5', Q221: '5' }), name: 'Stringified Object', headers: { 'Content-Type': 'application/json' } },
        { payload: { answers: { Q220: '5', Q221: '5' } }, name: 'Wrapped Object' },
        { payload: [{ key: 'Q220', value: '5' }, { key: 'Q221', value: '5' }], name: 'Array Form Data equivalent' },
        { payload: { value: { Q220: '5', Q221: '5' } }, name: 'value wrapped' }
    ];

    for (const test of payloadsToTest) {
        console.log('Testing', test.name);
        try {
            const h = test.headers ? { ...headers, ...test.headers } : headers;
            const res = await axios.post(url, test.payload, { headers: h, httpsAgent: agent, validateStatus: () => true, timeout: 5000 });
            console.log('Status:', res.status, res.data.result || res.data);
            if (res.status === 200) break;
        } catch (e) { console.log('Err:', e.message); }
    }
}
findWorkingPayload();
