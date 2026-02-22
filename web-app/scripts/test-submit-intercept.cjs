// Script to intercept the real Addanswer payload format
// by looking at how the university's Angular app calls the API.
// Run: node scripts/test-submit-intercept.cjs
require('dotenv').config({ path: '.env.local' });
const axios = require('axios');
const https = require('https');
const zlib = require('zlib');
const { promisify } = require('util');
const gunzip = promisify(zlib.gunzip);
const { encryptForReg } = require('../lib/regCipherUtils');

const agent = new https.Agent({ rejectUnauthorized: false });
const REG4_URL = 'https://reg4.kmutnb.ac.th/regapiweb2/api/th';
const REG3_URL = 'https://reg3.kmutnb.ac.th/regapiweb1/api/th';
const REG2_URL = 'https://reg2.kmutnb.ac.th/regapiweb3/api/th';

const HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'application/json, text/plain, */*',
};

async function login() {
    const { data: { token: serviceToken } } = await axios.get(`${REG4_URL}/Validate/tokenservice`, { httpsAgent: agent, headers: HEADERS });
    const creds = encryptForReg(JSON.stringify({ username: process.env.REG_USERNAME, password: process.env.REG_PASSWORD, ip: '' }));
    const { data: { token } } = await axios.post(`${REG4_URL}/Account/LoginAD`, { param: creds }, { httpsAgent: agent, headers: { ...HEADERS, 'Authorization': `Bearer ${serviceToken}` } });
    return token;
}

async function getFirstPendingEval(token) {
    const { data } = await axios.get(`${REG3_URL}/Evaluateofficer/Class`, { httpsAgent: agent, headers: { ...HEADERS, 'Authorization': `Bearer ${token}` } });
    const courses = JSON.parse((await gunzip(Buffer.from(data.result, 'base64'))).toString('utf-8'));
    for (const course of courses) {
        if (!course.instructor) continue;
        for (const inst of course.instructor) {
            if (inst.evaluatestatus === 0 || inst.evaluatestatus === '0') {
                return { classid: course.classid, evaluateid: inst.evaluateid, officerid: inst.officerid, name: inst.officername };
            }
        }
    }
    return null;
}

async function getQuestions(token, { classid, evaluateid, officerid }) {
    const { data } = await axios.get(`${REG2_URL}/Evaluateofficerform/Evaluatequestion/${classid}/${evaluateid}/${officerid}`, {
        httpsAgent: agent,
        headers: { ...HEADERS, 'Authorization': `Bearer ${token}` }
    });
    let raw = data;
    if (raw && raw.result) {
        raw = JSON.parse((await gunzip(Buffer.from(raw.result, 'base64'))).toString('utf-8'));
    }
    return Array.isArray(raw) ? raw : [];
}

// --- Test EXACT Addanswer endpoint variants ---
async function testAddanswer(token, evalInfo, questions, testMode = 'dry') {
    console.log('\n=== Testing Addanswer endpoint variants ===');
    const { classid, evaluateid, officerid } = evalInfo;

    // Build answers (all "5" for each question)
    const answers = {};
    questions.forEach(q => { answers[q.questionid] = '5'; });

    // The exact structure we need to figure out. Let's try several known formats:
    const formats = [
        {
            name: 'Format E: commit with evaluatechoice structured answers',
            url: `${REG2_URL}/Evaluateofficerform/commit/${classid}/${evaluateid}/${officerid}`,
            body: {
                classid, evaluateid, officerid,
                answers: questions.map(q => ({
                    evaluateid: parseInt(evaluateid),
                    questionid: q.questionid,
                    choiceid: '5',
                    point: 5
                }))
            }
        },
        {
            name: 'Format F: commit with flat array of questions as body',
            url: `${REG2_URL}/Evaluateofficerform/commit/${classid}/${evaluateid}/${officerid}`,
            body: questions.map((q, idx) => ({
                ...q,
                evaluatechoice: q.evaluatechoice.map(c => ({ ...c, check: c.choiceid === '5' }))
            }))
        }
    ];

    for (const fmt of formats) {
        try {
            const encryptedBody = { param: encryptForReg(JSON.stringify(fmt.body)) };
            console.log(`\n[Testing] ${fmt.name}`);
            console.log(`[URL] ${fmt.url}`);
            console.log(`[Raw body (first 200 chars)] ${JSON.stringify(fmt.body).substring(0, 200)}`);

            if (testMode === 'dry') {
                console.log('[DRY RUN - Not sending. Set testMode to "live" to actually submit]');
                continue;
            }

            const res = await axios.post(fmt.url, encryptedBody, {
                httpsAgent: agent,
                headers: { ...HEADERS, 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                validateStatus: () => true
            });
            console.log(`[Response Status] ${res.status}`);
            console.log(`[Response Data] ${JSON.stringify(res.data)}`);

            if (res.status === 200) {
                console.log(`\n✅✅✅ FORMAT WORKS: ${fmt.name}\n`);
            }

        } catch (e) {
            console.error(`[Error] ${e.message}`);
        }
    }
}

async function main() {
    console.log('Logging in...');
    const token = await login();
    console.log('Login OK. Finding pending evaluation...');

    const evalInfo = await getFirstPendingEval(token);
    if (!evalInfo) {
        console.log('No pending evaluations found!');
        return;
    }
    console.log(`Found pending: ${evalInfo.name}`, evalInfo);

    const questions = await getQuestions(token, evalInfo);
    console.log(`Got ${questions.length} questions.`);
    console.log('\nFirst question structure:', JSON.stringify(questions[0], null, 2));

    // Change 'dry' to 'live' to actually test submitting to the API
    await testAddanswer(token, evalInfo, questions, 'live');
}

main().catch(console.error);
