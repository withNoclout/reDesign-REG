const { chromium } = require('playwright');
require('dotenv').config({ path: '.env.local' });

async function run() {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();

    console.log('Navigating to reg...');
    const url = 'https://reg2.kmutnb.ac.th/regapiweb3/th/';

    try {
        await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
        console.log('Current URL after goto:', page.url());

        // Let it render
        await page.waitForTimeout(5000);

        console.log('Current URL after timeout:', page.url());

        const content = await page.content();
        console.log('HTML CONTENT:');
        console.log(content.substring(0, 1500)); // First 1500 chars

        // See if there's an iframe or shadow dom
        const frames = page.frames();
        console.log('Number of frames:', frames.length);

    } catch (e) {
        console.error('Error:', e.message);
        console.log('Current URL on error:', page.url());
    } finally {
        await browser.close();
    }
}
run();
