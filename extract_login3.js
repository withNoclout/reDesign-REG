const fs = require('fs');
const c = fs.readFileSync('d:/reDesign-REG/main_bundle.js', 'utf8');

// Find the login component — search for the login page/component
// The login page must have a method that collects username/password and calls the HTTP service
// Look for login component/module patterns

const loginPatterns = [
    'LoginComponent', 'loginComponent', 'LoginPage', 'loginpage',
    'LoginModule', 'loginmodule',
    'formLogin', 'loginForm', 'loginform',
    'usercode', 'UserCode', 'studentid', 'StudentId',
    'txtuser', 'txtpass', 'txtUsername', 'txtPassword',
    'ngModel', 'formControl',
    '/login',
    'login"', "login'",
    'Account/LoginAD', 'LoginAD',
    'LoginAAD',
    'doLogin', 'submitLogin', 'btnLogin',
    'signin', 'SignIn',
    'this.post(', 'this.http.post('
];

loginPatterns.forEach(p => {
    let idx = c.indexOf(p);
    if (idx > -1) {
        // Only show first occurrence
        console.log(`\n--- "${p}" at ${idx} ---`);
        console.log(c.substring(Math.max(0, idx - 150), idx + 250));
        console.log('---');
    } else {
        console.log(`"${p}": NOT FOUND`);
    }
});

// Specifically look for the login service/component that calls post() with Account
// The http service's post() encrypts data and sends to the endpoint path
// LoginAD is the endpoint — it's passed as the first arg to post()
// Let's find where 'LoginAD' or 'Account/LoginAD' is called
console.log('\n\n=== Searching for LoginAD and LoginAAD ===');
['LoginAD', 'LoginAAD', 'loginAD', 'loginaad', 'Login_AD', 'login_ad'].forEach(p => {
    let idx = 0;
    while (true) {
        idx = c.indexOf(p, idx);
        if (idx === -1) break;
        console.log(`\n--- ${p} at ${idx} ---`);
        console.log(c.substring(Math.max(0, idx - 200), idx + 300));
        idx++;
    }
});
