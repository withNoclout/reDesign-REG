
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

async function test() {
    console.log(`Logging in as ${username}...`);
    const agent = new https.Agent({ rejectUnauthorized: false });

    // 1. Get Token
    const loginRes = await axios.post('https://reg3.kmutnb.ac.th/regapiweb1/api/th/Authen/LoginAD', {
        username,
        password
    }, { httpsAgent: agent });

    if (loginRes.status !== 200) {
        console.error('Login failed');
        return;
    }

    const token = loginRes.data.token;
    console.log('Login successful.');

    // 2. Fetch Evaluations
    const res = await axios.get('https://reg3.kmutnb.ac.th/regapiweb1/api/th/Evaluateofficer/Class', {
        headers: { 'Authorization': `Bearer ${token}` },
        httpsAgent: agent
    });

    if (res.status === 200 && res.data?.result) {
        const compressedBuffer = Buffer.from(res.data.result, 'base64');
        const decompressed = await gunzip(compressedBuffer);
        const courses = JSON.parse(decompressed.toString('utf-8'));

        console.log(`Found ${courses.length} courses.`);
        const firstCourse = courses[0];
        console.log('--- Sample Course Structure ---');
        console.log('classid type:', typeof firstCourse.classid, 'value:', firstCourse.classid);

        if (firstCourse.instructor && firstCourse.instructor.length > 0) {
            const firstInst = firstCourse.instructor[0];
            console.log('--- Sample Instructor Structure ---');
            console.log('evaluateid type:', typeof firstInst.evaluateid, 'value:', firstInst.evaluateid);
            console.log('officerid type:', typeof firstInst.officerid, 'value:', firstInst.officerid);
            console.log('evaluatestatus:', firstInst.evaluatestatus);
        }
    } else {
        console.error('Failed to fetch evaluations');
    }
}

test();
