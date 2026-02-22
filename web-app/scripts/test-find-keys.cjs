const axios = require('axios');
const https = require('https');

const agent = new https.Agent({ rejectUnauthorized: false });

async function findAllKeys() {
    const mainRes = await axios.get('https://reg2.kmutnb.ac.th/registrar/main.efd0e6ba14d8dbbf.js', { httpsAgent: agent });
    const code = mainRes.data;

    // Find the full encrypt service class
    const classStart = code.indexOf('this.encryptSecretKey="mySecretKeyHere"');
    if (classStart > -1) {
        const chunk = code.substring(classStart - 200, classStart + 1500);
        console.log('=== Full Encrypt Service Class ===');
        console.log(chunk);
    }

    // Also check if the encryptSecretKey is overridden elsewhere
    console.log('\n\n=== Search for other encrypt keys ===');
    const keyPattern = /encryptSecretKey\s*[=:]\s*["']([^"']+)["']/g;
    let m;
    while ((m = keyPattern.exec(code)) !== null) {
        console.log(`Key: "${m[1]}"`);
    }

    // Check if AESkey is used instead
    console.log('\n=== Search for AESkey usage ===');
    const aesPattern = /AESkey\s*[=:]\s*["']([^"']+)["']/g;
    while ((m = aesPattern.exec(code)) !== null) {
        console.log(`AESkey: "${m[1]}"`);
    }

    // Maybe they use encryptAES instead of encryptData for some endpoints
    console.log('\n=== Check if encryptAES is used in POST ===');
    const encAesPattern = /(.{0,200}encryptAES.{0,200})/g;
    while ((m = encAesPattern.exec(code)) !== null) {
        if (m[1].includes('post') || m[1].includes('http') || m[1].includes('param')) {
            console.log(m[1]);
        }
    }
}

findAllKeys().catch(console.error);
