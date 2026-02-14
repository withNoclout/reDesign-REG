const fs = require('fs');
const c = fs.readFileSync('d:/reDesign-REG/main_bundle.js', 'utf8');

// The error is "Padding is invalid" which means the server successfully found 
// and tried to decrypt our data but failed.
// This could be because the server uses a DIFFERENT key.
// Let me search for ALL keys/secrets in the bundle

// Search for secret, key, passphrase patterns
const keyPatterns = [
    'SecretKey', 'secretKey', 'secret_key', 'SECRET_KEY',
    'AESkey', 'aeskey', 'AES_KEY',
    'mySecret', 'passphrase',
    'encryptSecretKey',
    'key=', 'Key=',
    'keyHere',
    'sQeWwhHUKB3VTrwX'
];

keyPatterns.forEach(p => {
    let idx = 0;
    let count = 0;
    while (count < 3) {
        idx = c.indexOf(p, idx);
        if (idx === -1) break;
        console.log(`\n--- "${p}" at ${idx} ---`);
        console.log(c.substring(Math.max(0, idx - 100), idx + 200));
        idx++;
        count++;
    }
});

// Also specifically look for the constructor of the encryption service
// We saw: this.encryptSecretKey="mySecretKeyHere",this.AESkey="sQeWwhHUKB3VTrwX...
// Let me get the FULL context of the class
const classIdx = c.indexOf('encryptSecretKey');
if (classIdx > -1) {
    console.log('\n\n========== FULL ENCRYPTION SERVICE CLASS ==========');
    // Go back further to find the class start, then show more
    console.log(c.substring(Math.max(0, classIdx - 200), classIdx + 800));
}
