// test-submit-hypo.cjs
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
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
    'Accept': 'application/json, text/plain, */*'
};

async function main() {
    const { data: { token: serviceToken } } = await axios.get(`${REG4_URL}/Validate/tokenservice`, { httpsAgent: agent, headers: HEADERS });
    const { data: { token } } = await axios.post(`${REG4_URL}/Account/LoginAD`, { param: encryptForReg(JSON.stringify({ username: process.env.REG_USERNAME, password: process.env.REG_PASSWORD, ip: '' })) }, { httpsAgent: agent, headers: { ...HEADERS, 'Authorization': `Bearer ${serviceToken}` } });

    const { data: classData } = await axios.get(`${REG3_URL}/Evaluateofficer/Class`, { httpsAgent: agent, headers: { ...HEADERS, 'Authorization': `Bearer ${token}` } });
    const courses = JSON.parse((await gunzip(Buffer.from(classData.result, 'base64'))).toString('utf-8'));

    let evalInfo = null;
    for (const c of courses) {
        if (!c.instructor) continue;
        for (const t of c.instructor) {
            if (t.evaluatestatus === 0 || t.evaluatestatus === '0') {
                evalInfo = { classid: c.classid, evaluateid: t.evaluateid, officerid: t.officerid };
                break;
            }
        }
        if (evalInfo) break;
    }
    if (!evalInfo) { console.log('No pending.'); return; }

    const { data: qData } = await axios.get(`${REG2_URL}/Evaluateofficerform/Evaluatequestion/${evalInfo.classid}/${evalInfo.evaluateid}/${evalInfo.officerid}`, { httpsAgent: agent, headers: { ...HEADERS, 'Authorization': `Bearer ${token}` } });
    const questions = JSON.parse((await gunzip(Buffer.from(qData.result, 'base64'))).toString('utf-8'));

    // Step 1: Modify the questions array exactly like Angular's two-way binding would
    for (const q of questions) {
        if (!q.evaluatechoice) continue;
        for (const c of q.evaluatechoice) {
            if (c.choiceid === '5' || c.point === 5) {
                c.check = true;
            } else {
                c.check = false;
            }
        }
    }

    // Attempt pushing to Addanswer {class}/{eval}/{officer}
    try {
        const payloadStr = JSON.stringify(questions);
        const encrypted = encryptForReg(payloadStr);
        console.log('Sending modified questions array to Addanswer...');
        const addUrl = `${REG2_URL}/Evaluateofficerform/Addanswer/${evalInfo.classid}/${evalInfo.evaluateid}/${evalInfo.officerid}`;
        const addRes = await axios.post(addUrl, { param: encrypted }, { httpsAgent: agent, validateStatus: () => true, headers: { ...HEADERS, 'Authorization': `Bearer ${token}` } });
        console.log('Addanswer status:', addRes.status, JSON.stringify(addRes.data));
    } catch (e) { console.error('Addanswer error', e.message); }

    // Attempt pushing to commit {class}/{eval}/{officer}
    try {
        const commitPayload = JSON.stringify({
            classid: evalInfo.classid,
            evaluateid: evalInfo.evaluateid,
            officerid: evalInfo.officerid
        });
        const encryptedCommit = encryptForReg(commitPayload);
        console.log('\nSending commit...');
        const commitUrl = `${REG2_URL}/Evaluateofficerform/commit/${evalInfo.classid}/${evalInfo.evaluateid}/${evalInfo.officerid}`;
        const commitRes = await axios.post(commitUrl, { param: encryptedCommit }, { httpsAgent: agent, validateStatus: () => true, headers: { ...HEADERS, 'Authorization': `Bearer ${token}` } });
        console.log('commit status:', commitRes.status, JSON.stringify(commitRes.data));
    } catch (e) { console.error('commit error', e.message); }
}
main().catch(console.error);
