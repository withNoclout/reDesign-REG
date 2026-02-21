const axios = require('axios');
const https = require('https');
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

        const payload = {
            Q220: '5', Q221: '5', Q222: '5', Q223: '5', Q224: '5',
            Q225: '5', Q226: '5', Q227: '5', Q229: '5', Q230: '5',
            Q231: '5', Q232: '5', Q233: '5', Q234: '5', Q235: '5',
            Q236: '5', Q237: '5', Q238: '5', Q239: '5'
        };

        const addUrl = `https://reg3.kmutnb.ac.th/regapiweb1/api/th/Evaluateofficerform/Addanswer/${evaluateid}/${classid}/${officerid}/1`;

        console.log('1. Trying Form Data...');
        const params = new URLSearchParams();
        Object.entries(payload).forEach(([k, v]) => params.append(k, v));
        try {
            const r1 = await axios.post(addUrl, params.toString(), {
                headers: { ...headers, 'Content-Type': 'application/x-www-form-urlencoded' },
                httpsAgent: agent,
                validateStatus: () => true
            });
            console.log(r1.status, JSON.stringify(r1.data));
        } catch (e) { }

        console.log('2. Trying Object with array of questions...');
        try {
            const body2 = Object.keys(payload).map(k => ({ key: k, value: payload[k] }));
            const r2 = await axios.post(addUrl, body2, { headers, httpsAgent: agent, validateStatus: () => true });
            console.log(r2.status, JSON.stringify(r2.data));
        } catch (e) { }

    } catch (e) { }
}
testSubmitAPI();
