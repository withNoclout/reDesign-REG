const fs = require('fs');
const c = fs.readFileSync('d:/reDesign-REG/main_bundle.js', 'utf8');

// Find all occurrences of encryptData
let idx = 0;
const matches = [];
while (true) {
    idx = c.indexOf('encryptData', idx);
    if (idx === -1) break;
    matches.push(idx);
    idx++;
}
console.log('encryptData found', matches.length, 'times at:', matches.join(', '));

// For each, show context
matches.forEach((pos, i) => {
    console.log(`\n--- encryptData occurrence #${i + 1} at ${pos} ---`);
    console.log(c.substring(Math.max(0, pos - 200), pos + 300));
});

// Also find LoginAD
const loginIdx = c.indexOf('LoginAD');
if (loginIdx > -1) {
    console.log('\n--- LoginAD context ---');
    console.log(c.substring(Math.max(0, loginIdx - 200), loginIdx + 400));
}

// Find TripleDES.encrypt or DES usage near app code
const patterns = ['TripleDES', 'DES)', 'CryptoJS', 'secretKey', 'encKey', 'key=', 'Pkcs7'];
patterns.forEach(p => {
    const pi = c.indexOf(p);
    if (pi > -1) {
        console.log(`\n--- ${p} at ${pi} ---`);
        console.log(c.substring(Math.max(0, pi - 100), pi + 200));
    }
});
