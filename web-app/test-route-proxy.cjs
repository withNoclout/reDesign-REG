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
        
        const myToken = res.data.token;
        const authHeaders = { Authorization: `Bearer ${myToken}`, "User-Agent": "Mozilla" };

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
        console.log("Found target:", target);
        
        // Mock frontend form Data
        const formData = {
           220: '5', 221: '5', 222: '5', 223: '5', 224: '5', 225: '5', 226: '5', 227: '5', 229: '5', 230: '5', 231: '5', 232: '5', 233: '5', 234: '5', 235: '5', 236: '5', 237: '5', 238: '5', 239: '5'
        };
        
        // Use local API proxy. Need dev server? Yes but wait, we can just call the file directly? No, we will start a server or write a quick fetch test since Next.js supports calling API from outside, but we need next dev. 
        // We will start the dev server then run this script. Let's just mock it manually first.
        console.log("Please run this while `npm run dev` is running on 3000.");
        
        const localApiData = {
            evaluateId: target.evaluateId, classId: target.classId, officerId: target.officerId, formData
        };

        const apiRes = await axios.post(`http://localhost:3000/api/student/evaluation/submit`, localApiData, {
             headers: { Cookie: `reg_token=${myToken}` },
             validateStatus: () => true
        });

        console.log("Proxy API Status:", apiRes.status);
        console.log("Proxy API Response:", apiRes.data);

        // Check verification again
        res = await axios.get(`https://reg3.kmutnb.ac.th/regapiweb1/api/th/Evaluateofficer/Class`, { headers: authHeaders, httpsAgent: agent });
        const checkCourses = JSON.parse((await gunzip(Buffer.from(res.data.result, 'base64'))).toString());
        let saved = false;
        checkCourses.forEach(c => c.instructor?.forEach(i => { if (i.officerid===target.officerId && i.evaluatestatus===1) saved=true; }));
        console.log("Saved verification? =>", saved ? "YES 🟢" : "NO 🔴");

    } catch(e) { console.error(e.message); }
}
run();
