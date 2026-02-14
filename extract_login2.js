const fs = require('fs');
const c = fs.readFileSync('d:/reDesign-REG/main_bundle.js', 'utf8');

// Find how the login component calls the HTTP service
// Look for the login component that provides username/password
const patterns = ['username', 'password', 'user_id', 'userid', 'stdid', 'loginclick', 'loginform', 'onLogin', 'doLogin', 'submitLogin', 'btnlogin', 'loginbtn'];
patterns.forEach(p => {
    let idx = c.indexOf(p);
    if (idx > -1) {
        // Show first occurrence context
        console.log(`\n--- "${p}" at ${idx} ---`);
        console.log(c.substring(Math.max(0, idx - 100), idx + 200));
        console.log('...');
    }
});

// Also look for the actual endpoint strings used with post()
// The Angular app might use variables like 'Account/LoginAD'
console.log('\n\n========== ACCOUNT ENDPOINT SEARCH ==========');
let idx = 0;
while (true) {
    idx = c.indexOf('Account/', idx);
    if (idx === -1) break;
    console.log(`\n--- "Account/" at ${idx} ---`);
    console.log(c.substring(Math.max(0, idx - 50), idx + 150));
    idx++;
}
