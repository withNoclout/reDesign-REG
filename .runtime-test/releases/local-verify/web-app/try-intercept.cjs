const { chromium } = require('playwright');
require('dotenv').config({ path: '.env.local' });

async function run() {
    console.log('Starting Playwright...');
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();

    let interceptedPayloads = [];

    // Log all requests to Addanswer or commit
    page.on('request', request => {
        const url = request.url();
        if (url.includes('Addanswer') || url.includes('commit') || url.includes('Evaluateofficerform')) {
            if (request.method() === 'POST') {
                console.log(`\n[INTERCEPT] POST ${url}`);
                console.log('Headers:', request.headers());
                console.log('Post Data:', request.postData());
                interceptedPayloads.push({
                    url,
                    postData: request.postData()
                });
            }
        }
    });

    console.log('Navigating to reg4 login...');
    await page.goto('https://reg4.kmutnb.ac.th/regapiweb2/api/th', { waitUntil: 'networkidle' });

    // Since we can't easily script the Angular login flow without knowing the DOM, 
    // let's try to just use axios with the known API, but we already tried and failed.
    // Wait... the playwright script is running on the terminal!
    console.log('Closing browser...');
    await browser.close();
}

run().catch(console.error);
