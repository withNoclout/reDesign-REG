const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env.local') });
const axios = require('axios');
async function test() {
    console.log('Logging in...');
    const login = await axios.post('http://localhost:3000/api/auth/login', { username: process.env.REG_USERNAME || 's6701091611290', password: process.env.REG_PASSWORD || '035037603za' });
    const cookies = login.headers['set-cookie'];
    console.log('Fetching evaluations...');
    try {
        const res = await axios.get('http://localhost:3000/api/student/evaluation', { headers: { Cookie: cookies.join('; ') } });
        console.log(JSON.stringify(res.data, null, 2));
    } catch (e) {
        console.error(e.response ? e.response.data : e.message);
    }
}
test();
