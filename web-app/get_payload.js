const axios = require('axios');
const https = require('https');
const crypto = require('crypto');
const zlib = require('zlib');
const fs = require('fs');
const { promisify } = require('util');
const gunzip = promisify(zlib.gunzip);

require('dotenv').config({ path: '.env.local' });

function encryptForReg(plaintext) {
    const ENCRYPT_SECRET_KEY = process.env.ENCRYPT_SECRET_KEY;
    const salt = crypto.randomBytes(16);
    const derivedKey = crypto.pbkdf2Sync(ENCRYPT_SECRET_KEY, salt, 100, 32, 'sha1');
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', derivedKey, iv);
    cipher.setAutoPadding(true);
    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    return Buffer.concat([salt, iv, encrypted]).toString('base64');
}

const agent = new https.Agent({ rejectUnauthorized: false });

async function run() {
    try {
        const BASE_URL = 'https://reg4.kmutnb.ac.th/regapiweb2/api/th';
        let res = await axios.get(`${BASE_URL}/Validate/tokenservice`, { httpsAgent: agent });
        const token = res.data.token;
        
        const creds = JSON.stringify({ username: process.env.REG_USERNAME, password: process.env.REG_PASSWORD, ip: "" });
        const reqBody = { param: encryptForReg(creds) };
        res = await axios.post(`${BASE_URL}/Account/LoginAD`, reqBody, {
            headers: { Authorization: `Bearer ${token}` },
            httpsAgent: agent
        });
        const bearer = res.data.token;
        const authHeaders = { Authorization: `Bearer ${bearer}`, "User-Agent": "Mozilla" };

        const REG3_BASE = 'https://reg3.kmutnb.ac.th/regapiweb1/api/th';
        res = await axios.get(`${REG3_BASE}/Evaluateofficer/Class`, { headers: authHeaders, httpsAgent: agent });
        
        const compressedBuffer = Buffer.from(res.data.result, 'base64');
        const decompressed = await gunzip(compressedBuffer);
        const courses = JSON.parse(decompressed.toString('utf-8'));
        
        let target = null;
        for (const course of courses) {
            if (course.instructor && Array.isArray(course.instructor)) {
                const inst = course.instructor.find(i => i.evaluatestatus === 0);
                if (inst) {
                    target = { courseId: course.courseid, classId: course.classid, evaluateId: inst.evaluateid, officerId: inst.officerid };
                    break;
                }
            }
        }
        
        if (!target) {
            console.log("No pending evaluation found.");
            return;
        }
        
        console.log("Found evaluation target: ", target);
        
        const REG2_BASE = 'https://reg2.kmutnb.ac.th/regapiweb3/api/th';
        const qUrl = `${REG2_BASE}/Evaluateofficerform/Evaluatequestion/${target.classId}/${target.evaluateId}/${target.officerId}`;
        res = await axios.get(qUrl, { headers: authHeaders, httpsAgent: agent });
        
        const qCompressed = Buffer.from(res.data.result, 'base64');
        const qDecompressed = await gunzip(qCompressed);
        const questions = JSON.parse(qDecompressed.toString('utf-8'));
        
        fs.writeFileSync('questions.json', JSON.stringify(questions, null, 2));
        console.log("Saved raw questions to questions.json");
    } catch (e) {
        console.error(e);
    }
}
run();
