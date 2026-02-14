const fs = require('fs');
const c = fs.readFileSync('d:/reDesign-REG/main_bundle.js', 'utf8');

// Find the login service class and its method that calls LoginAD
// Let's search for 'Account/' to find all API calls 
const patterns = ['Account/', 'LoginAD', 'login(', 'Login(', 'loginad', 'loginAD'];
patterns.forEach(p => {
    let idx = 0;
    while (true) {
        idx = c.indexOf(p, idx);
        if (idx === -1) break;
        console.log(`\n--- "${p}" at ${idx} ---`);
        console.log(c.substring(Math.max(0, idx - 200), idx + 300));
        idx++;
    }
});

// Also search near the encrypt service for how it's called during login
// The "post" method uses encryptData - let's see what's CALLING this.post()
// Find the Login method that calls post('Account/LoginAD', ...)
const loginCallPatterns = ['Account/LoginAD', 'LoginAD'];
loginCallPatterns.forEach(p => {
    let idx = 0;
    while (true) {
        idx = c.indexOf(p, idx);
        if (idx === -1) break;
        console.log(`\n=== "${p}" at ${idx} ===`);
        console.log(c.substring(Math.max(0, idx - 400), idx + 200));
        idx++;
    }
});
