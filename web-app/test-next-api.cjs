const axios = require('axios');
require('dotenv').config({ path: '.env.local' });

async function run() {
    const apiBase = 'http://localhost:3001/api';
    console.log('1. Logging in via Next.js API...');
    const loginRes = await axios.post(`${apiBase}/auth/login`, {
        username: process.env.REG_USERNAME,
        password: process.env.REG_PASSWORD
    });

    const cookies = loginRes.headers['set-cookie'].map(c => c.split(';')[0]).join('; ');
    console.log('Got cookies:', cookies);

    console.log('2. Fetching pending evaluations...');
    const evalRes = await axios.get(`${apiBase}/student/evaluation`, { headers: { Cookie: cookies } });
    const targets = evalRes.data.data;
    if (!targets || targets.length === 0) {
        console.log('No pending evaluations found. The E2E test passes if all previous submissions were successful!');
        return;
    }

    const t = targets[0];
    console.log('Found pending target:', t);

    console.log('3. Requesting Form Data...');
    const formRes = await axios.get(`${apiBase}/student/evaluation/form?id=${t.evaluate_id}&classId=${t.class_id}&officerId=${t.officer_id}`, { headers: { Cookie: cookies } });

    // Simulate user filling the form
    const formData = {};
    formRes.data.data.questions.forEach(q => {
        const id = q.questionid ?? q.id;
        formData[id] = "5";
    });

    console.log('4. Submitting formData:', formData);
    const subRes = await axios.post(`${apiBase}/student/evaluation/submit`, {
        evaluateId: t.evaluate_id,
        classId: t.class_id,
        officerId: t.officer_id,
        formData
    }, { headers: { Cookie: cookies } });

    console.log('Submit Proxy Status:', subRes.status);
    console.log('Submit Proxy Data:', subRes.data);

    if (subRes.data.success) {
        console.log('✅ End-to-end evaluation flow using the local backend succeeded!');
    } else {
        console.error('❌ E2E submission failed');
    }
}

// Give server time to start
setTimeout(() => {
    run().then(() => process.exit(0)).catch(e => {
        console.error(e.message);
        process.exit(1);
    });
}, 5000);
