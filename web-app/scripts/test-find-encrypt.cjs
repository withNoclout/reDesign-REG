const axios = require('axios');
const https = require('https');

const agent = new https.Agent({ rejectUnauthorized: false });

async function findEncrypt() {
    const mainRes = await axios.get('https://reg2.kmutnb.ac.th/registrar/main.efd0e6ba14d8dbbf.js', { httpsAgent: agent });
    const code = mainRes.data;

    // Find encryptData method
    console.log('=== Finding encryptData method ===');
    const encryptPattern = /encryptData\s*\(\s*\w+\s*\)\s*\{[^}]*\}/g;
    let m;
    while ((m = encryptPattern.exec(code)) !== null) {
        console.log(`\n${m[0]}`);
    }

    // Broader search
    console.log('\n=== Broader encryptData context ===');
    const broadPattern = /(.{0,100}encryptData.{0,500})/g;
    const seen = new Set();
    while ((m = broadPattern.exec(code)) !== null) {
        const text = m[1].substring(0, 500);
        if (!seen.has(text) && (text.includes('encrypt') || text.includes('CryptoJS') || text.includes('AES') || text.includes('key'))) {
            console.log(`\n${text}`);
            seen.add(text);
        }
    }

    // Search for CryptoJS or encryption key
    console.log('\n=== CryptoJS / encryption key ===');
    const cryptoPattern = /(.{0,100}(?:CryptoJS|AES|decrypt|encrypt|secretKey|encKey).{0,300})/g;
    const cryptoSeen = new Set();
    while ((m = cryptoPattern.exec(code)) !== null) {
        const text = m[1].substring(0, 300);
        if (!cryptoSeen.has(text) && text.length > 30) {
            console.log(`\n${text}`);
            cryptoSeen.add(text);
        }
    }
}

findEncrypt().catch(console.error);
