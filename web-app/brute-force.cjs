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

async function getAuthToken() {
    const BASE_URL = 'https://reg4.kmutnb.ac.th/regapiweb2/api/th';
    let res = await axios.get(`${BASE_URL}/Validate/tokenservice`, { httpsAgent: agent });
    const token = res.data.token;

    const creds = JSON.stringify({ username: process.env.REG_USERNAME, password: process.env.REG_PASSWORD, ip: "" });
    const reqBody = { param: encryptForReg(creds) };
    res = await axios.post(`${BASE_URL}/Account/LoginAD`, reqBody, {
        headers: { Authorization: `Bearer ${token}` },
        httpsAgent: agent
    });
    return res.data.token;
}

async function getTarget(bearer) {
    const authHeaders = { Authorization: `Bearer ${bearer}`, "User-Agent": "Mozilla" };
    const REG3_BASE = 'https://reg3.kmutnb.ac.th/regapiweb1/api/th';
    const res = await axios.get(`${REG3_BASE}/Evaluateofficer/Class`, { headers: authHeaders, httpsAgent: agent });

    const compressedBuffer = Buffer.from(res.data.result, 'base64');
    const decompressed = await gunzip(compressedBuffer);
    const courses = JSON.parse(decompressed.toString('utf-8'));

    for (const course of courses) {
        if (course.instructor && Array.isArray(course.instructor)) {
            const inst = course.instructor.find(i => i.evaluatestatus === 0);
            if (inst) return { courseId: course.courseid, classId: course.classid, evaluateId: inst.evaluateid, officerId: inst.officerid };
        }
    }
    return null;
}

async function isEvaluated(bearer, evaluateId) {
    const authHeaders = { Authorization: `Bearer ${bearer}`, "User-Agent": "Mozilla" };
    const REG3_BASE = 'https://reg3.kmutnb.ac.th/regapiweb1/api/th';
    const res = await axios.get(`${REG3_BASE}/Evaluateofficer/Class`, { headers: authHeaders, httpsAgent: agent });

    const compressedBuffer = Buffer.from(res.data.result, 'base64');
    const decompressed = await gunzip(compressedBuffer);
    const courses = JSON.parse(decompressed.toString('utf-8'));

    for (const course of courses) {
        if (course.instructor && Array.isArray(course.instructor)) {
            const inst = course.instructor.find(i => i.evaluateid === evaluateId);
            if (inst) return inst.evaluatestatus === 1;
        }
    }
    return false;
}

async function runTest() {
    console.log("Starting brute force payload tester...");
    const bearer = await getAuthToken();
    const target = await getTarget(bearer);
    if (!target) {
        console.log("No pending evaluations left to test! (If it's evaluated, you succeeded earlier!)");
        return;
    }
    console.log("Target:", target);

    const questionsJSON = JSON.parse(fs.readFileSync('questions.json', 'utf8'));

    // Payload Variations
    const variations = [
        {
            name: "Variation 1: The correct group map logic",
            createAnswer: () => questionsJSON.map(q => ({
                evaluateid: q.evaluateid,
                evaluategroup: q.evaluategroup,
                questionid: q.questionid,
                score: 5
            })),
            commit: { classid: target.classId, evaluateid: target.evaluateId, officerid: target.officerId }
        },
        {
            name: "Variation 2: Include choicetype",
            createAnswer: () => questionsJSON.map(q => ({
                evaluateid: q.evaluateid,
                evaluategroup: q.evaluategroup,
                questionid: q.questionid,
                score: 5,
                choicetype: q.questiontype || "Q"
            })),
            commit: { classid: target.classId, evaluateid: target.evaluateId, officerid: target.officerId }
        },
        {
            name: "Variation 3: Exact chosen choice object",
            createAnswer: () => questionsJSON.map(q => {
                const choice = q.evaluatechoice.find(c => c.choiceid === "5") || q.evaluatechoice[0];
                return { ...choice, check: true, point: 5 };
            }),
            commit: { classid: target.classId, evaluateid: target.evaluateId, officerid: target.officerId }
        },
        {
            name: "Variation 4: Commit with empty object + Choice IDs",
            createAnswer: () => questionsJSON.map(q => ({
                evaluateid: target.evaluateId,
                evaluategroup: q.evaluategroup,
                questionid: q.questionid,
                choiceid: "5",
            })),
            commit: {}
        }
    ];

    const authHeaders = { Authorization: `Bearer ${bearer}`, "User-Agent": "Mozilla", "Content-Type": "application/json" };
    const REG2_BASE = 'https://reg2.kmutnb.ac.th/regapiweb3/api/th';

    for (let i = 0; i < variations.length; i++) {
        const v = variations[i];
        console.log(`\n--- Testing ${v.name} ---`);
        const answ = v.createAnswer();

        const addUrl = `${REG2_BASE}/Evaluateofficerform/Addanswer`;
        const commitUrl = `${REG2_BASE}/Evaluateofficerform/commit/${target.classId}/${target.evaluateId}/${target.officerId}`;

        console.log("Posting Addanswer", JSON.stringify(answ[0]));
        const resA = await axios.post(addUrl, { param: encryptForReg(JSON.stringify(answ)) }, { headers: authHeaders, httpsAgent: agent, validateStatus: () => true });
        console.log("Addanswer status:", resA.status);

        console.log("Posting Commit", JSON.stringify(v.commit));
        const resC = await axios.post(commitUrl, { param: encryptForReg(JSON.stringify(v.commit)) }, { headers: authHeaders, httpsAgent: agent, validateStatus: () => true });
        console.log("Commit status:", resC.status);

        // Wait to allow DB to update
        await new Promise(r => setTimeout(r, 2000));

        const ok = await isEvaluated(bearer, target.evaluateId);
        if (ok) {
            console.log(`\n\n🎉 SUCCESS! Variation matched: ${v.name}`);
            console.log("Answers payload format:", JSON.stringify(answ.slice(0, 1), null, 2));
            console.log("Commit payload:", JSON.stringify(v.commit));
            return;
        } else {
            console.log("Failed. Target still not evaluated.");
        }
    }
}

runTest().catch(console.error);
