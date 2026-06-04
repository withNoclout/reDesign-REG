const { chromium } = require('playwright');
require('dotenv').config({ path: '.env.local' });

async function main() {
    console.log('Username:', process.env.REG_USERNAME);
    if (!process.env.REG_USERNAME) {
        console.error("Missing REG_USERNAME");
        return;
    }

    const browser = await chromium.launch({ headless: false }); 
    const context = await browser.newContext({ ignoreHTTPSErrors: true });
    const page = await context.newPage();

    console.log('Navigating to reg portal...');
    // The main login portal is usually reg3 or reg4 depending on the load balancer
    await page.goto('https://kmutnb.ac.th', { waitUntil: 'domcontentloaded' }).catch(() => {});
    await page.goto('https://reg3.kmutnb.ac.th/regapiweb1/th/', { waitUntil: 'domcontentloaded' }).catch(() => {});

    console.log('Login and try to get to course evaluation...');

    // Listen to network requests
    page.on('request', request => {
        const url = request.url();
        if ((url.includes('Addanswer') || url.includes('commit') || url.includes('Evaluateofficerform')) && request.method() === 'POST') {
            console.log(`\n\n==== INTERCEPTED ${request.method()} TO: ${url} ====`);
            console.log('Payload Data:', request.postData());
        }
    });

    console.log('Waiting 120 seconds... Please login manually if needed and click submit.');
    await page.waitForTimeout(120000);

    await browser.close();
}

main().catch(console.error);
