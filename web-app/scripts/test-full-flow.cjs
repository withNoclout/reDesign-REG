const axios = require('axios');
const https = require('https');
const zlib = require('zlib');
const { promisify } = require('util');
require('dotenv').config({ path: '.env.local' });

const gunzip = promisify(zlib.gunzip);
const agent = new https.Agent({ rejectUnauthorized: false });

async function findUnevaluatedAndTest() {
    try {
        const loginRes = await axios.post('http://localhost:3000/api/auth/login', {
            username: process.env.REG_USERNAME,
            password: process.env.REG_PASSWORD
        });
        const token = loginRes.headers['set-cookie'].find(c => c.startsWith('reg_token=')).split(';')[0].split('=')[1];
        const headers = { 'Authorization': `Bearer ${token}` };

        // 1. Get list of evaluations
        const listUrl = 'https://reg3.kmutnb.ac.th/regapiweb1/api/th/Evaluateofficer/Class';
        const listRes = await axios.get(listUrl, { headers, httpsAgent: agent });
        const courses = JSON.parse(zlib.gunzipSync(Buffer.from(listRes.data.result, 'base64')).toString());

        console.log('=== All Courses ===');
        courses.forEach((course, i) => {
            console.log(`[${i}] ${course.coursecode} ${course.coursename}`);
            if (course.instructor) {
                course.instructor.forEach((inst, j) => {
                    console.log(`    Instructor[${j}]: ${inst.officername} ${inst.officersurname}`);
                    console.log(`      evaluateid=${inst.evaluateid} | evaluatestatus=${inst.evaluatestatus} | officerid=${inst.officerid} | classid=${course.classid}`);
                });
            }
        });

        // 2. Find first unevaluated instructor
        let target = null;
        for (const course of courses) {
            if (course.instructor) {
                for (const inst of course.instructor) {
                    if (inst.evaluatestatus === 0) {
                        target = { classid: course.classid, evaluateid: inst.evaluateid, officerid: inst.officerid, coursename: course.coursename };
                        break;
                    }
                }
            }
            if (target) break;
        }

        if (!target) {
            console.log('\n⚠️ No unevaluated courses found!');
            // All have been evaluated already. That's why Addanswer returns 404 — 
            // the 404 means "no unevaluated record" not "endpoint not found"!
            console.log('\nAll courses have evaluatestatus=1. The 404 from Addanswer was because that evaluation was already submitted!');
            return;
        }

        console.log(`\n=== Target (unevaluated): ${target.coursename} ===`);
        console.log(`classid=${target.classid}, evaluateid=${target.evaluateid}, officerid=${target.officerid}`);

        // 3. Try getting questions for this one
        const qUrl = `https://reg3.kmutnb.ac.th/regapiweb1/api/th/Evaluateofficerform/Evaluatequestion/${target.classid}/${target.evaluateid}/${target.officerid}`;
        console.log(`\nFetching questions: ${qUrl}`);
        const qRes = await axios.get(qUrl, { headers, httpsAgent: agent, validateStatus: () => true });
        console.log(`Questions status: ${qRes.status}`);

        if (qRes.status === 200 && qRes.data?.result) {
            const questions = JSON.parse(zlib.gunzipSync(Buffer.from(qRes.data.result, 'base64')).toString());
            console.log(`Got ${questions.length} questions`);

            // Build payload
            const payload = {};
            questions.forEach(q => {
                if (q.questiontype === 'H') return;
                if (q.questiontype === 'Q') {
                    payload[q.questiontype + '' + q.questionid] = '5';
                } else if (q.questiontype === 'C') {
                    payload[q.questiontype + '' + q.questionid] = q.description || '';
                }
            });
            payload['Ctxt'] = 'สอนดีมากครับ';
            payload['complaints'] = '';

            console.log('Payload keys:', Object.keys(payload).join(', '));

            // 4. Try Addanswer
            const addUrl = `https://reg3.kmutnb.ac.th/regapiweb1/api/th/Evaluateofficerform/Addanswer/${target.evaluateid}/${target.classid}/${target.officerid}/1`;
            console.log(`\nPOST Addanswer: ${addUrl}`);
            const addRes = await axios.post(addUrl, payload, { headers, httpsAgent: agent, validateStatus: () => true });
            console.log(`Addanswer status: ${addRes.status}`);
            console.log('Response:', JSON.stringify(addRes.data));
        }

    } catch (e) {
        console.error(e.message);
    }
}

findUnevaluatedAndTest();
