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

        const payload = {
            Q220: '5', Q221: '5', Q222: '5', Q223: '5', Q224: '5',
            Q225: '5', Q226: '5', Q227: '5', Q229: '5', Q230: '5',
            Q231: '5', Q232: '5', Q233: '5', Q234: '5', Q235: '5',
            Q236: '5', Q237: '5', Q238: '5', Q239: '5'
        };

        const servers = [
            'https://reg3.kmutnb.ac.th/regapiweb1/api/th',
            'https://reg4.kmutnb.ac.th/regapiweb2/api/th'
        ];

        for (const server of servers) {
            const addUrl = `${server}/Evaluateofficerform/Addanswer/${evaluateid}/${classid}/${officerid}/1`;
            console.log(`\nPOST to ${addUrl}...`);
            try {
                const addRes = await axios.post(addUrl, payload, { headers, httpsAgent: agent, validateStatus: () => true });
                console.log(`Addanswer status: ${addRes.status}`);
                console.log(addRes.data);
            } catch (e) { }
        }

    } catch (e) {
        console.error(e.message);
    }
}

testSubmitAPI();
