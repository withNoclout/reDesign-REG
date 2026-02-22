const puppeteer = require('puppeteer');
require('dotenv').config({ path: '.env.local' });

async function run() {
    console.log('Starting Puppeteer with headed mode...');
    const browser = await puppeteer.launch({ headless: false, defaultViewport: null });
    const page = await browser.newPage();
    
    // Intercept network requests
    await page.setRequestInterception(true);
    page.on('request', interceptedRequest => {
        const url = interceptedRequest.url();
        if ((url.includes('Addanswer') || url.includes('commit') || url.includes('Evaluateofficerform')) && interceptedRequest.method() === 'POST') {
            console.log(`\n\n==== INTERCEPTED POST TO: ${url} ====`);
            console.log('Payload Data:', interceptedRequest.postData());
        }
        interceptedRequest.continue();
    });

    console.log('Navigating to portal...');
    // We will just let the user login in the opened browser window
    await page.goto('https://reg2.kmutnb.ac.th/regapiweb3/th/');
    
    // Fill credentials if possible
    try {
        await page.waitForSelector('input[type="text"]', { timeout: 5000 });
        await page.type('input[type="text"]', process.env.REG_USERNAME || '');
        await page.type('input[type="password"]', process.env.REG_PASSWORD || '');
    } catch(e) {}

    console.log('\n--- ATTENTION ---');
    console.log('Please log in manually if needed, solve the captcha, and click to evaluate a professor.');
    console.log('The script will wait for 120 seconds to capture the POST payload on submit.');
    
    // Wait for user interaction
    await new Promise(resolve => setTimeout(resolve, 120000));
    console.log('Finished waiting. Closing browser.');
    await browser.close();
}

run().catch(console.error);

