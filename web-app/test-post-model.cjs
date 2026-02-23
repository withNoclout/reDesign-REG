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

async function runTestModel() {
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
    const authHeaders = {
        Authorization: `Bearer ${bearer}`,
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Content-Type": "application/json"
    };

    const questionsJSON = JSON.parse(fs.readFileSync('questions.json', 'utf8'));

    const variations = [
        {
            name: "Original 2202 map (bad group map)",
            create: () => questionsJSON.map(q => ({
                evaluateid: 125,
                evaluategroup: q.questionid.toString(), // Wrong! Just simulating the route.js to see if it gives 200
                score: 5
            }))
        },
        {
            name: "Exact evaluatechoice object",
            create: () => questionsJSON.map(q => {
                const choice = q.evaluatechoice.find(c => c.choiceid === "5");
                return { ...choice, check: true, chkdescription: choice.description };
            })
        },
        {
            name: "Stripped evaluatechoice object",
            create: () => questionsJSON.map(q => ({
                evaluateid: q.evaluateid,
                questionid: q.questionid,
                choiceid: "5",
                point: 5,
                check: true,
                choicetype: "Q"
            }))
        },
        {
            name: "Form data array style",
            create: () => questionsJSON.map(q => ({
                questionid: q.questionid,
                choiceid: "5"
            }))
        }
    ];

    const URL = `https://reg2.kmutnb.ac.th/regapiweb3/api/th/Evaluateofficerform/Addanswer`;

    for (const v of variations) {
        console.log(`\nTesting ${v.name}`);
        const dataStr = JSON.stringify(v.create());
        console.log("-> sending sample:", JSON.stringify(v.create().slice(0, 1)));

        const payload = { param: encryptForReg(dataStr) };
        const res = await axios.post(URL, payload, { headers: authHeaders, httpsAgent: agent, validateStatus: () => true });
        console.log("<- Status:", res.status);
    }
}

runTestModel().catch(console.error);
