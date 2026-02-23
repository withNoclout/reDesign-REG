import 'dotenv/config';
import axios from 'axios';
import https from 'https';
import zlib from 'zlib';
import { promisify } from 'util';
import { encryptForReg } from './lib/regCipherUtils.js'; // Assuming this exists or encryptPassword

const gunzip = promisify(zlib.gunzip);

async function test() {
    console.log('Testing Schedule API...');
    const username = process.env.REG_USERNAME;
    const password = process.env.REG_PASSWORD;

    if (!username || !password) {
        console.error('Missing REG_USERNAME or REG_PASSWORD');
        return;
    }

    try {
        console.log('1. Logging in...');
        const loginRes = await axios.post('http://localhost:3000/api/auth/login', {
            username, password
        });

        const cookies = loginRes.headers['set-cookie'];
        const regTokenCookie = cookies.find(c => c.startsWith('reg_token='));
        const regToken = regTokenCookie.split(';')[0].split('=')[1];

        console.log('Got token:', regToken.substring(0, 20) + '...');

        console.log('2. Fetching Timetable...');
        const agent = new https.Agent({ rejectUnauthorized: false });
        // The schedule route uses reg3...
        const timetableRes = await axios.get(
            `https://reg3.kmutnb.ac.th/regapiweb1/api/th/Timetable/Timetable/2568/2`,
            {
                headers: { 'Authorization': `Bearer ${regToken}` },
                httpsAgent: agent
            }
        );

        const base64Data = timetableRes.data.result;
        if (!base64Data) {
            console.log('No result in timetableres:', timetableRes.data);
            return;
        }

        const compressedBuffer = Buffer.from(base64Data, 'base64');
        const decompressed = await gunzip(compressedBuffer);
        const scheduleJson = JSON.parse(decompressed.toString('utf-8'));

        console.log(`Decoded ${scheduleJson.length} courses!`);
        for (const item of scheduleJson) {
            console.log(`Course: ${item.coursecode}`);
            console.log(`Time HTML: ${item.time}`);
            console.log('-------------------------');
        }

    } catch (err) {
        console.error('Error:', err.message);
        if (err.response) console.error(err.response.data);
    }
}

test();
