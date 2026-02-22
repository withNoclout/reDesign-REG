const axios = require('axios');
const https = require('https');

const agent = new https.Agent({ rejectUnauthorized: false });

async function findPostMethod() {
    const mainRes = await axios.get('https://reg2.kmutnb.ac.th/registrar/main.efd0e6ba14d8dbbf.js', { httpsAgent: agent });
    const code = mainRes.data;

    // Find the requestService class and its post/get methods
    // We know: this.baseurl = apiUrl + random + "/api/"
    // requestService has .post(), .get(), .delete() methods

    // Find the class that has baseurl and post method
    console.log('=== Finding requestService POST method ===');

    // Look for post method that uses baseurl
    const postPattern = /post\s*\(\s*(\w+)\s*,\s*(\w+)\s*\)\s*\{[^}]{0,500}\}/g;
    let m;
    while ((m = postPattern.exec(code)) !== null) {
        if (m[0].includes('baseurl') || m[0].includes('http')) {
            console.log(`\nFound post method:\n${m[0]}`);
        }
    }

    // More flexible search
    console.log('\n=== Broader search for post with baseurl ===');
    const broadPattern = /(.{0,100}baseurl.{0,200}post.{0,200})|(.{0,100}post.{0,200}baseurl.{0,200})/g;
    while ((m = broadPattern.exec(code)) !== null) {
        console.log(`\n${(m[1] || m[2]).substring(0, 300)}`);
    }

    // Find requestService class block
    console.log('\n=== RequestService class definition ===');
    const classIndex = code.indexOf('this.baseurl=R.N.apiUrl');
    if (classIndex > -1) {
        // Extract a large chunk around this
        const chunk = code.substring(classIndex - 200, classIndex + 2000);
        console.log(chunk);
    }
}

findPostMethod().catch(console.error);
