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
    const authHeaders = { Authorization: `Bearer ${bearer}`, "User-Agent": "Mozilla", "Content-Type": "application/json" };

    const REG3_BASE = 'https://reg3.kmutnb.ac.th/regapiweb1/api/th';
    res = await axios.get(`${REG3_BASE}/Evaluateofficer/Class`, { headers: authHeaders, httpsAgent: agent });
    const compressedBuffer = Buffer.from(res.data.result, 'base64');
    const decompressed = await gunzip(compressedBuffer);
    const courses = JSON.parse(decompressed.toString('utf-8'));

    let target = null;
    for (const course of courses) {
        if (course.instructor) {
            target = course.instructor.find(i => i.evaluatestatus === 0);
            if (target) {
                target = { classId: course.classid, evaluateId: target.evaluateid, officerId: target.officerid };
                break;
            }
        }
    }

    if (!target) {
        console.log("No pending evaluation left!");
        return;
    }

    // Now test Addanswer URLs
    const urlsToTest = [
        `https://reg2.kmutnb.ac.th/regapiweb3/api/th/Evaluateofficerform/Addanswer`,
        `https://reg2.kmutnb.ac.th/regapiweb3/api/th/Evaluateofficerform/Addanswer/${target.evaluateId}`,
        `https://reg2.kmutnb.ac.th/regapiweb3/api/th/Evaluateofficerform/Addanswer/${target.classId}/${target.evaluateId}/${target.officerId}`,
        `https://reg3.kmutnb.ac.th/regapiweb1/api/th/Evaluateofficerform/Addanswer`,
        `https://reg3.kmutnb.ac.th/regapiweb1/api/th/Evaluateofficerform/Addanswer/${target.evaluateId}`,
        `https://reg3.kmutnb.ac.th/regapiweb1/api/th/Evaluateofficerform/Addanswer/${target.classId}/${target.evaluateId}/${target.officerId}`
    ];

    // Dummy answers 
    // Wait, we need to fetch questions first to get correct evaluategroup and IDs!
    const REG2_BASE = 'https://reg2.kmutnb.ac.th/regapiweb3/api/th';
    const qUrl = `${REG2_BASE}/Evaluateofficerform/Evaluatequestion/${target.classId}/${target.evaluateId}/${target.officerId}`;
    res = await axios.get(qUrl, { headers: authHeaders, httpsAgent: agent });
    const qDecompressed = await gunzip(Buffer.from(res.data.result, 'base64'));
    const questionsJSON = JSON.parse(qDecompressed.toString('utf-8'));

    const answ = questionsJSON.map(q => ({
        evaluateid: target.evaluateId,
        evaluategroup: q.evaluategroup,
        questionid: q.questionid,
        score: 5
    }));

    const payload = { param: encryptForReg(JSON.stringify(answ)) };

    for (const u of urlsToTest) {
        console.log("Testing:", u);
        const r = await axios.post(u, payload, { headers: authHeaders, httpsAgent: agent, validateStatus: () => true });
        console.log("-> Status:", r.status);
    }
}
run();
