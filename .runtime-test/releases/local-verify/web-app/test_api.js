require('dotenv').config({ path: '.env.local' });
const axios = require('axios');

async function run() {
    try {
        console.log(`Logging in as ${process.env.REG_USERNAME}...`);
        const loginRes = await axios.post('http://localhost:3000/api/auth/login', {
            username: process.env.REG_USERNAME,
            password: process.env.REG_PASSWORD
        });

        const cookiesRaw = loginRes.headers['set-cookie'] || [];
        const cookieStr = cookiesRaw.map(c => c.split(';')[0]).join('; ');

        console.log("Login successful. Fetching exam seats...");
        const response = await axios.get('http://localhost:3000/api/student/exam-seat?courseCode=040203213', {
            headers: { Cookie: cookieStr }
        });
        console.log("Success:", response.data);
    } catch (e) {
        if (e.response) {
            console.log("HTTP ERROR:", e.response.status);
            console.log("DATA:", JSON.stringify(e.response.data, null, 2));
        } else {
            console.log("NETWORK ERROR:", e.message);
        }
    }
}
run();
