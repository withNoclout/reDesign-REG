import 'dotenv/config';
import axios from 'axios';

async function testLocalSchedule() {
    console.log('Testing Local Schedule API...');
    const username = process.env.REG_USERNAME;
    const password = process.env.REG_PASSWORD;

    try {
        console.log('1. Logging in...');
        const loginRes = await axios.post('http://localhost:3000/api/auth/login', {
            username, password
        });

        const cookies = loginRes.headers['set-cookie'];
        const cookieString = cookies.map(c => c.split(';')[0]).join('; ');

        console.log('2. Fetching local schedule API...');
        const scheduleRes = await axios.get('http://localhost:3000/api/student/schedule', {
            headers: { Cookie: cookieString }
        });

        console.log('Status:', scheduleRes.status);
        const data = scheduleRes.data;
        console.log('Success:', data.success);
        console.log('Semester:', data.semester);
        console.log('Total Scheduled:', data.scheduled?.length);
        console.log('Scheduled items:', JSON.stringify(data.scheduled, null, 2));

    } catch (err) {
        console.error('Error:', err.message);
        if (err.response) {
            console.error('Error Response:', err.response.data);
        }
    }
}

testLocalSchedule();
