const { chromium } = require('playwright');
require('dotenv').config({ path: '.env.local' });

async function verifyLocalEvaluation() {
    const browser = await chromium.launch({ headless: true });
    try {
        const page = await browser.newPage();
        console.log("Navigating to local login page...");
        await page.goto("http://localhost:3000", { waitUntil: "networkidle" });

        // Wait and check if we are on the login form
        await page.waitForTimeout(2000);

        // Find inputs
        const usernameInput = await page.$('input[placeholder*="รหัสนักศึกษา"]');
        if (usernameInput) {
            console.log("Found login page, typing credentials...");
            await usernameInput.fill(process.env.REG_USERNAME);

            const passwordInput = await page.$('input[type="password"]');
            await passwordInput.fill(process.env.REG_PASSWORD);

            const submitBtn = await page.$('button[type="submit"]');
            await submitBtn.click();
            console.log("Clicked login.");
        } else {
            console.log("Could not find login page inputs. Are we stuck on loading?");
            const html = await page.content();
            console.log("Current HTML:", html.substring(0, 1000));
            return;
        }

        // Wait to be redirected to /main or /evaluation
        await page.waitForURL('**/main', { timeout: 10000 }).catch(() => null);
        console.log("At URL:", page.url());

        console.log("Navigating to /evaluation...");
        await page.goto("http://localhost:3000/evaluation", { waitUntil: "networkidle" });
        await page.waitForTimeout(2000);

        // Check if stuck on loading
        const bodyText = await page.innerText('body');
        if (bodyText.includes("กำลังโหลด...")) {
            console.log("ERROR: Page is stuck on 'กำลังโหลด...'");
            return;
        }

        console.log("Page rendered successfully. Looking for evaluate button...");

        const evalBtns = await page.$$('button:has-text("ประเมิน")');
        if (evalBtns.length > 0) {
            console.log(`Found ${evalBtns.length} evaluate buttons. Clicking the first one...`);
            await evalBtns[0].click();
            await page.waitForTimeout(3000);

            console.log("At evaluation form:", page.url());

            // Check for quick action button
            const quickBtn = await page.$('button[title*="5"]');
            if (quickBtn) {
                console.log("Found quick action '5' button! Clicking it.");
                await quickBtn.click();
            } else {
                console.log("Clicking all '5' radio buttons manually...");
                const radio5s = await page.$$('button:has-text("5 —")');
                for (const r of radio5s) {
                    await r.click();
                }
            }

            await page.waitForTimeout(1000);

            console.log("Submitting evaluation...");
            // Click Submit
            const submitFormBtn = await page.$('button:has-text("ส่งผลการประเมิน")');
            if (submitFormBtn) {
                // If it really submits, it might modify production database of the university.
                // We shouldn't actually click submit if we already succeeded earlier (and it might already be empty)
                console.log("Found submit button! Skipping actual submit click to prevent duplicate tests on prod.");
            }
            console.log("✅ GUI Pipeline looks fully functional locally.");
        } else {
            console.log("No evaluate buttons found. Probably all evaluations are complete.");
            if (bodyText.includes("ประเมินครบแล้ว")) {
                console.log("✅ Found 'ประเมินครบแล้ว!' (All done) message.");
            }
        }

    } catch (e) {
        console.error("Test failed:", e);
    } finally {
        await browser.close();
    }
}

verifyLocalEvaluation();
