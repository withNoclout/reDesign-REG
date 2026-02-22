require('dotenv').config({ path: '.env.local' });
const axios = require('axios');
const https = require('https');
const zlib = require('zlib');
const { promisify } = require('util');
const { encryptForReg } = require('./lib/regCipherUtils');

const gunzip = promisify(zlib.gunzip);
const BASE_URL = 'https://reg3.kmutnb.ac.th/regapiweb1/api/th';
const LOGIN_BASE_URL = 'https://reg4.kmutnb.ac.th/regapiweb2/api/th';

const agent = new https.Agent({ rejectUnauthorized: false });

async function getAuthToken() {
    const username = process.env.REG_USERNAME || 's6701091611176';
    const password = process.env.REG_PASSWORD || 'tengneng';
    const tokenResponse = await axios.get(`${LOGIN_BASE_URL}/Validate/tokenservice`, { httpsAgent: agent });
    const token = tokenResponse.data.token;
    const credentialsJson = JSON.stringify({ username, password, ip: '' });
    const encryptedParam = encryptForReg(credentialsJson);

    const loginResponse = await axios.post(
        `${LOGIN_BASE_URL}/Account/LoginAD`,
        { param: encryptedParam },
        { headers: { 'Authorization': `Bearer ${token}` }, httpsAgent: agent }
    );
    return loginResponse.data.token;
}

async function runTest() {
    try {
        const authToken = await getAuthToken();
        const config = {
            headers: { 'Authorization': `Bearer ${authToken}` },
            httpsAgent: agent,
            validateStatus: () => true
        };

        const classRes = await axios.get(`${BASE_URL}/Evaluateofficer/Class`, config);
        let evaluateId = null;

        if (classRes.data && classRes.data.result) {
            const compressed = Buffer.from(classRes.data.result, 'base64');
            const decompressed = await gunzip(compressed);
            const courses = JSON.parse(decompressed.toString('utf-8'));

            console.log("\n--- Class List ---");
            for (const course of courses) {
                // Determine course name based on keys that might exist
                const courseName = course.coursenameeng || course.coursenamethai || course.subjectname || course.coursename || "Unknown";
                const courseNo = course.courseno || course.subjectcode || "Unknown";
                const section = course.section || "Unknown";
                console.log(`Course: ${courseName} (${courseNo}) Sec: ${section}`);

                if (course.instructor) {
                    for (const inst of course.instructor) {
                        console.log(`  - Instructor: ${inst.officername}, evaluateId: ${inst.evaluateid}, status: ${inst.evaluatestatus}`);

                        // Pick the first un-evaluated one
                        if ((inst.evaluatestatus === 0 || inst.evaluatestatus === "0") && !evaluateId) {
                            evaluateId = inst.evaluateid;
                            console.log(`\n[!] Selecting ${courseName} - ${inst.officername} (ID: ${evaluateId}) for questions test.\n`);
                        }
                    }
                }
            }
            console.log("------------------\n");
        }

        if (!evaluateId) {
            console.log('[-] No pending evaluations found for logged in user. Testing with 125 anyway...');
            evaluateId = 125;
        }

        // Test group combinations
        const groupRes = await axios.get(`${BASE_URL}/Evaluateofficerform/Evaluategroup/${evaluateId}`, config);
        console.log(`EvaluateGroup [${evaluateId}]:`, groupRes.status);

        const groups = groupRes.data;
        if (Array.isArray(groups) && groups.length > 0) {
            console.log('Testing Evaluatequestion variations...');

            // Guess variations based on traditional REST or Angular router params
            const variations = [
                `${BASE_URL}/Evaluateofficerform/Question/${evaluateId}`,
                `${BASE_URL}/Evaluateofficerform/Evaluatequestion?evaluateid=${evaluateId}`,
                `${BASE_URL}/Evaluateofficerform/QuestionList/${evaluateId}`,
                `${BASE_URL}/Evaluateofficerform/Listquestion/${evaluateId}`,
                // Try fetching questions for a specific group ID (e.g., group 10)
                `${BASE_URL}/Evaluateofficerform/Evaluatequestion/${evaluateId}/${groups[0].evaluategroup}`
            ];

            for (const url of variations) {
                const qRes = await axios.get(url, config);
                console.log(`\nURL: ${url}`);
                console.log(`Status: ${qRes.status}`);
                if (qRes.status === 200) {
                    if (qRes.data.result) {
                        const compressed = Buffer.from(qRes.data.result, 'base64');
                        const decompressed = await gunzip(compressed);
                        console.log('SUCCESS! Data:', decompressed.toString('utf-8').substring(0, 300));
                    } else {
                        console.log('SUCCESS! Data:', JSON.stringify(qRes.data).substring(0, 300));
                    }
                }
            }
        }

    } catch (e) {
        console.error('Test Error:', e.message);
    }
}

runTest();
