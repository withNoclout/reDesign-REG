
import axios from 'axios';
import https from 'https';
import zlib from 'zlib';
import { promisify } from 'util';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const gunzip = promisify(zlib.gunzip);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env.local') });

const username = process.env.REG_USERNAME;
const password = process.env.REG_PASSWORD;

async function checkIds() {
    console.log(`Checking IDs for ${username}...`);
    const agent = new https.Agent({ rejectUnauthorized: false });

    // 1. Login
    const loginRes = await axios.post('https://reg4.kmutnb.ac.th/regapiweb2/api/th/Account/LoginAD', {
        username,
        password
    }, { httpsAgent: agent, validateStatus: () => true });

    if (loginRes.status !== 200) {
        // Try reg2 if reg4 fails or is different
        console.log('Reg4 login failed, might need real login flow. Using token from cookies logic...');
    }

    // Let's assume we can get the list if we have a token. 
    // Since I can't easily get the token without a full login, I'll check my previous inspect-eval-types.mjs attempt.
    // It failed with 404 because the URL was reg3? Let's check the real code.
}

// Rewriting a better version of inspect-eval-types.mjs using the correct URL from login info
async function realCheck() {
    const agent = new https.Agent({ rejectUnauthorized: false });
    const BASE_URL = 'https://reg4.kmutnb.ac.th/regapiweb2/api/th';

    console.log('Logging in...');
    const tokenRes = await axios.get(`${BASE_URL}/Validate/tokenservice`, { httpsAgent: agent });
    const token = tokenRes.data.token;

    // This is the real complex login. Let's just mock the logic check if possible or use a simpler endpoint.
    // Actually, I can just look at the code logic in route.js and see if I missed any string conversions.
}

// Let's just inspect the logic in route.js very carefully.
checkIds();
