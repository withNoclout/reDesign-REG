/**
 * Script to automate logging in, opening Evaluate, and intercepting the POST payload
 */
const { chromium } = require('playwright');
require('dotenv').config({ path: '.env.local' });

async function main() {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();

    console.log('Navigating to reg...');
    await page.goto('https://reg2.kmutnb.ac.th/regapiweb3/th/');

    // Fill login
    await page.fill('input[type="text"]', process.env.REG_USERNAME);
    await page.fill('input[type="password"]', process.env.REG_PASSWORD);
    await page.locator('button', { hasText: 'เข้าสู่ระบบ' }).click();

    // Wait for login to complete
    await page.waitForTimeout(3000);

    // Click "อื่นๆ" (Other) then "ประเมินอาจารย์" (Evaluate Teacher) if it exists
    try {
        await page.goto('https://reg2.kmutnb.ac.th/regapiweb3/th/#/course-evaluation');
    } catch (e) {
        console.log('Failed to navigate directly to course evaluation');
    }

    // Wait for the list of teachers to appear
    await page.waitForTimeout(3000);

    // Listen to network requests
    page.on('request', request => {
        const url = request.url();
        if (url.includes('Evaluateofficerform/Addanswer') || url.includes('Evaluateofficerform/commit')) {
            console.log(`\n\n==== INTERCEPTED ${request.method()} TO: ${url} ====`);
            console.log('Payload Data:', request.postData());
        }
    });

    // Click the first Evaluate button
    try {
        const evalBtn = page.locator('button', { hasText: 'ประเมิน' }).first();
        await evalBtn.click();
        await page.waitForTimeout(2000);

        // Fill out random 5 for all radios (quick action if using custom DOM, but this is the real reg site)
        console.log('Clicking all radio buttons to 5...');
        const radios = await page.$$('input[type="radio"][value="5"]');
        for (const radio of radios) {
            await radio.evaluate(node => node.click());
        }
        await page.waitForTimeout(1000);

        console.log('Clicking Submit (บันทึก)...');
        // Find submit button
        const submitBtn = page.locator('button', { hasText: 'บันทึก' }).first();
        if (await submitBtn.isVisible()) {
            await submitBtn.click();
        } else {
            console.log('Submit button not found');
        }

        await page.waitForTimeout(4000); // give time for network request to be sent
    } catch (e) {
        console.error('Error in interaction:', e.message);
    }

    await browser.close();
}

main().catch(console.error);
