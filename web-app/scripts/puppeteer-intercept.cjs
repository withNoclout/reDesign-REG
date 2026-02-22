/**
 * Script to automate logging in, opening Evaluate, and intercepting the POST payload
 */
const puppeteer = require('puppeteer');
require('dotenv').config({ path: '.env.local' });

async function main() {
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();

    // Intercept network
    await page.setRequestInterception(true);
    page.on('request', request => {
        if (request.method() === 'POST' && request.url().includes('api/th')) {
            console.log(`\n==== INTERCEPTED POST TO: ${request.url()} ====`);
            console.log('Payload Data:', request.postData());
        }
        request.continue();
    });

    console.log('Navigating to reg...');
    await page.goto('https://reg2.kmutnb.ac.th/regapiweb3/th/', { waitUntil: 'networkidle2' });

    // Login
    try {
        console.log('Checking for login...');
        const inputs = await page.$$('input.form-control');
        if (inputs.length >= 2) {
            console.log('Typing credentials...');
            await inputs[0].type(process.env.REG_USERNAME);
            await inputs[1].type(process.env.REG_PASSWORD);
            await page.click('button.w-100');
            await new Promise(r => setTimeout(r, 5000));
        }
    } catch (e) {
        console.log('Login skip or error:', e.message);
    }

    // Direct navigation
    console.log('Navigating to evaluation...');
    await page.goto('https://reg2.kmutnb.ac.th/regapiweb3/th/#/course-evaluation', { waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 5000));

    try {
        console.log('Looking for evaluate buttons...');
        const clicked = await page.evaluate(() => {
            const btns = Array.from(document.querySelectorAll('button'));
            const evalBtn = btns.find(b => b.textContent.includes('ประเมิน'));
            if (evalBtn) {
                evalBtn.click();
                return true;
            }
            return false;
        });

        if (!clicked) {
            console.log('No Evaluate button found.');
        }

        await new Promise(r => setTimeout(r, 5000));

        console.log('Answering questions...');
        await page.evaluate(() => {
            const radios = document.querySelectorAll('input[type="radio"][value="5"]');
            radios.forEach(r => r.click());
        });

        await new Promise(r => setTimeout(r, 2000));

        console.log('Submitting...');
        await page.evaluate(() => {
            const btns = Array.from(document.querySelectorAll('button'));
            const submitBtn = btns.find(b => b.textContent.includes('บันทึก'));
            if (submitBtn) submitBtn.click();
        });

        console.log('Waiting for network capture...');
        await new Promise(r => setTimeout(r, 15000));

    } catch (e) {
        console.error('Task error:', e.message);
    }

    await browser.close();
}

main().catch(console.error);
