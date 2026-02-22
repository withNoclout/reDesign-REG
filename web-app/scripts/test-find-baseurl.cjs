const axios = require('axios');
const https = require('https');

const agent = new https.Agent({ rejectUnauthorized: false });

async function findRequestService() {
    // The angular app uses `this.http` which is an instance of requestService
    // requestService is injected in the constructor
    // Let's search all chunks for the requestService class and its POST method

    // Get main bundle
    const mainRes = await axios.get('https://reg2.kmutnb.ac.th/registrar/main.efd0e6ba14d8dbbf.js', { httpsAgent: agent });
    const code = mainRes.data;

    // Search for requestService class definition
    console.log('=== Looking for request service / HTTP interceptor ===');

    // Pattern: class with post method that adds base URL
    const patterns = [
        /(.{0,300}requestService.{0,300}post.{0,300})/g,
        /(.{0,200}apiUrl.{0,200})/g,
        /(.{0,300}environment\.apiUrl.{0,300})/g,
        /(.{0,300}\.post\(.{0,50}Evaluat.{0,200})/g,
    ];

    for (const pattern of patterns) {
        let m;
        while ((m = pattern.exec(code)) !== null) {
            console.log(`\nFound: ${m[1].substring(0, 300)}`);
        }
    }

    // Find the environment config
    console.log('\n\n=== Environment config ===');
    const envPattern = /production:\s*!0.{0,500}/g;
    let m;
    while ((m = envPattern.exec(code)) !== null) {
        console.log(m[0].substring(0, 500));
    }

    // Find requestService or HttpService class
    console.log('\n\n=== HttpService or RequestService class ===');
    const svcPattern = /(.{0,100}[Rr]equestService.{0,400})/g;
    const seen = new Set();
    while ((m = svcPattern.exec(code)) !== null) {
        const text = m[1].substring(0, 400);
        if (!seen.has(text) && (text.includes('http') || text.includes('post') || text.includes('get') || text.includes('url') || text.includes('api'))) {
            console.log(`\n${text}`);
            seen.add(text);
        }
    }
}

findRequestService().catch(console.error);
