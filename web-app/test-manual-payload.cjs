const axios = require('axios');
const https = require('https');
const crypto = require('crypto');
const zlib = require('zlib');
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
        let res = await axios.get(`https://reg4.kmutnb.ac.th/regapiweb2/api/th/Validate/tokenservice`, { httpsAgent: agent });
        const token = res.data.token;
        const reqBody = { param: encryptForReg(JSON.stringify({ username: process.env.REG_USERNAME, password: process.env.REG_PASSWORD, ip: "" })) };
        res = await axios.post(`https://reg4.kmutnb.ac.th/regapiweb2/api/th/Account/LoginAD`, reqBody, { headers: { Authorization: `Bearer ${token}` }, httpsAgent: agent });
        const authHeaders = { Authorization: `Bearer ${res.data.token}`, "User-Agent": "Mozilla" };

        res = await axios.get(`https://reg3.kmutnb.ac.th/regapiweb1/api/th/Evaluateofficer/Class`, { headers: authHeaders, httpsAgent: agent });
        const courses = JSON.parse((await gunzip(Buffer.from(res.data.result, 'base64'))).toString());
        
        let target = null;
        for (const c of courses) {
            if (c.instructor && Array.isArray(c.instructor)) {
                const inst = c.instructor.find(i => i.evaluatestatus === 0);
                if (inst) { target = { classId: c.classid, evaluateId: inst.evaluateid, officerId: inst.officerid }; break; }
            }
        }
        if (!target) return console.log("No pending evaluation.");
        
        const REG2_BASE = 'https://reg2.kmutnb.ac.th/regapiweb3/api/th';
        res = await axios.get(`${REG2_BASE}/Evaluateofficerform/Evaluatequestion/${target.classId}/${target.evaluateId}/${target.officerId}`, { headers: authHeaders, httpsAgent: agent });
        const questions = JSON.parse((await gunzip(Buffer.from(res.data.result, 'base64'))).toString());

        // Construct Addanswer payload
        const flatObj = {};
        questions.forEach(q => {
            if (q.questiontype === 'H') return;
            if (q.questiontype === 'Q') flatObj['Q' + q.questionid] = '5';
            else if (q.questiontype === 'C') flatObj['C' + q.questionid] = '';
        });
        flatObj['Ctxt'] = 'None';
        flatObj['complaints'] = 'None';

        console.log("Submitting Addanswer...");
        let addRes = await axios.post(`${REG2_BASE}/Evaluateofficerform/Addanswer/${target.evaluateId}/${target.classId}/${target.officerId}/1`, 
            { param: encryptForReg(JSON.stringify(flatObj)) }, { headers: authHeaders, httpsAgent: agent, validateStatus: () => true });
        
        console.log("Addanswer Result:", addRes.data);

        // Found from Angular extracted code:
        // this.http.post("Evaluateofficerform/commit/"+this.evaluateid2+"/"+this.classid+"/"+this.officerid,{}).then(...)
        // THE PAYLOAD IS AN EMPTY OBJECT {} OR NULL!

        console.log("Submitting Commit with {}...");
        let commitRes = await axios.post(`${REG2_BASE}/Evaluateofficerform/commit/${target.evaluateId}/${target.classId}/${target.officerId}`, 
            { param: encryptForReg(JSON.stringify({})) }, 
            { headers: authHeaders, httpsAgent: agent, validateStatus: () => true });
        
        console.log("Commit Result ({}):", commitRes.data);
        
        // Wait, notice the URL URL order in the Angular code...
        // Addanswer is: "Evaluateofficerform/Addanswer/" + this.evaluateid + "/" + this.classid + "/" + this.officerid + "/1"
        // Commit is: "Evaluateofficerform/commit/" + this.evaluateid + "/" + this.classid + "/" + this.officerid (! WAIT, earlier scripts used classId/evaluateid. Look at Angular code: evaluateid2, classid, officerid!)
        
        let commitRes2 = await axios.post(`${REG2_BASE}/Evaluateofficerform/commit/${target.classId}/${target.evaluateId}/${target.officerId}`, 
            { param: encryptForReg(JSON.stringify({})) }, 
            { headers: authHeaders, httpsAgent: agent, validateStatus: () => true });
        console.log("Commit Result (classId first):", commitRes2.data);
        
        // Check if saved
        res = await axios.get(`https://reg3.kmutnb.ac.th/regapiweb1/api/th/Evaluateofficer/Class`, { headers: authHeaders, httpsAgent: agent });
        const checkCourses = JSON.parse((await gunzip(Buffer.from(res.data.result, 'base64'))).toString());
        let saved = false;
        checkCourses.forEach(c => c.instructor?.forEach(i => { if (i.officerid===target.officerId && i.evaluatestatus===1) saved=true; }));
        console.log("Saved? =>", saved);

    } catch (e) { console.error(e); }
}
run();
