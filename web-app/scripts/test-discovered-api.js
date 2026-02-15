const axios = require('axios');
const https = require('https');

const agent = new https.Agent({ rejectUnauthorized: false });
const BASE_URL = 'https://reg4.kmutnb.ac.th/regapiweb2/api/th';

/**
 * Script สำหรับทดสอบ API endpoint ที่หาเจอจาก reg3 Network tab
 * 
 * วิธีใช้:
 * 1. เปิด https://reg3.kmutnb.ac.th/registrar/timetable
 * 2. กด F12 → Network tab
 * 3. Refresh หน้า
 * 4. มองหา request ที่ส่งไป regapiweb2
 * 5. คัดลอก endpoint name มาใส่ในตัวแปร ENDPOINT_TO_TEST
 * 6. รัน: node scripts/test-discovered-api.js
 */

const ENDPOINT_TO_TEST = 'Enroll/YOUR_ENDPOINT_HERE';  // <-- ใส่ endpoint ที่เจอ

async function testDiscoveredAPI() {
  try {
    console.log('=== Testing Discovered API ===');
    console.log('Endpoint:', ENDPOINT_TO_TEST);
    console.log('');
    
    // Login first
    console.log('1. Login...');
    const loginRes = await axios.post('http://localhost:3000/api/auth/login', {
      username: 's6701091611290',
      password: '035037603za'
    });
    const token = loginRes.headers['set-cookie'].join('; ').match(/reg_token=([^;]+)/)[1];
    console.log('✅ Token received\n');
    
    const apiConfig = {
      httpsAgent: agent,
      headers: { 
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      validateStatus: () => true,
      timeout: 10000
    };
    
    // Test GET
    console.log('2. Testing GET request...');
    const getRes = await axios.get(`${BASE_URL}/${ENDPOINT_TO_TEST}`, apiConfig);
    console.log('Status:', getRes.status);
    
    if (getRes.status === 200) {
      console.log('✅ SUCCESS!');
      console.log('\nFull Response:');
      console.log(JSON.stringify(getRes.data, null, 2));
      
      if (Array.isArray(getRes.data)) {
        console.log('\nArray length:', getRes.data.length);
        if (getRes.data.length > 0) {
          console.log('First item keys:', Object.keys(getRes.data[0]));
        }
      }
    } else {
      console.log('❌ Failed');
      console.log('Response:', getRes.data);
      
      // Try POST
      console.log('\n3. Trying POST...');
      const postRes = await axios.post(`${BASE_URL}/${ENDPOINT_TO_TEST}`, {}, apiConfig);
      console.log('POST Status:', postRes.status);
      if (postRes.status === 200) {
        console.log('✅ POST SUCCESS!');
        console.log('Data:', JSON.stringify(postRes.data, null, 2));
      }
    }
    
  } catch (err) {
    console.error('Error:', err.message);
    if (err.response) {
      console.error('Response:', err.response.status, err.response.data);
    }
  }
}

// Test with different variations
async function testVariations() {
  console.log('\n=== Testing Common Variations ===\n');
  
  const loginRes = await axios.post('http://localhost:3000/api/auth/login', {
    username: 's6701091611290',
    password: '035037603za'
  });
  const token = loginRes.headers['set-cookie'].join('; ').match(/reg_token=([^;]+)/)[1];
  
  const apiConfig = {
    httpsAgent: agent,
    headers: { 
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    validateStatus: () => true
  };
  
  const variations = [
    'Enroll/GetTimetable',
    'Enroll/GetSchedule', 
    'Enroll/ShowTimetable',
    'Student/GetTimetable',
    'Student/GetSchedule'
  ];
  
  for (const endpoint of variations) {
    const res = await axios.get(`${BASE_URL}/${endpoint}`, apiConfig);
    if (res.status === 200) {
      console.log('✅', endpoint, '- Found!');
      console.log('   Data count:', Array.isArray(res.data) ? res.data.length : 'object');
    }
  }
}

// Run based on command line arg
if (process.argv[2] === 'variations') {
  testVariations().catch(console.error);
} else {
  testDiscoveredAPI().catch(console.error);
}
