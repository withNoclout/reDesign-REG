const axios = require('axios');
const zlib = require('zlib');
const { promisify } = require('util');

const gunzip = promisify(zlib.gunzip);

const BASE_URL = 'http://localhost:3000/api';

async function testEvalAPI() {
    try {
        console.log('1. Logging in...');
        const loginRes = await axios.post(`${BASE_URL}/auth/login`, {
            username: 's6701091611290',
            password: '035037603za'
        });

        const cookies = loginRes.headers['set-cookie'];
        const regTokenCookie = cookies.find(c => c.startsWith('reg_token='));
        const token = regTokenCookie ? regTokenCookie.split(';')[0].split('=')[1] : null;

        if (!token) throw new Error('Failed to get token');

        const urls = [
            'https://reg1.kmutnb.ac.th/regapiweb3/api/th/Evaluateofficer/GetHead?evaluateid=125',
            'https://reg1.kmutnb.ac.th/regapiweb3/api/th/Evaluateofficer/GetItem?evaluateid=125',
            'https://reg1.kmutnb.ac.th/regapiweb3/api/th/Evaluateofficer/GetEvaluationForm?evaluateid=125',
            'https://reg1.kmutnb.ac.th/regapiweb3/api/th/Evaluateofficer/Header?evaluateid=125',
            'https://reg1.kmutnb.ac.th/regapiweb3/api/th/Evaluateofficer/Items?evaluateid=125',
            'https://reg1.kmutnb.ac.th/regapiweb3/api/th/Evaluateofficer/Detail?evaluateid=125',
            'https://reg1.kmutnb.ac.th/regapiweb3/api/th/Evaluateofficer/Form?evaluateid=125'
        ];

        for (const url of urls) {
            try {
                process.stdout.write(`Trying ${url}... `);
                const res = await axios.get(url, { headers: { 'Authorization': `Bearer ${token}` } });
                console.log(`[SUCCESS]`);
                if (res.data.result) {
                    const decompressed = await gunzip(Buffer.from(res.data.result, 'base64'));
                    console.log(decompressed.toString('utf-8').substring(0, 500));
                } else {
                    console.log(JSON.stringify(res.data));
                }
            } catch (e) {
                console.log(`[FAILED] ${e.response?.status || e.message}`);
            }
        }

    } catch (e) {
        console.error('Error:', e.message);
    }
}

testEvalAPI();
