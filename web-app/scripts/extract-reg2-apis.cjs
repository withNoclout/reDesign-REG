// Extract API endpoints from reg2 Angular bundle
const axios = require('axios');
const https = require('https');

const agent = new https.Agent({ rejectUnauthorized: false });

async function findAPIs() {
    console.log('Fetching reg2 Angular main bundle...');

    // First get the index page to find the current main bundle name
    const indexRes = await axios.get('https://reg2.kmutnb.ac.th/registrar/login.aspx', { httpsAgent: agent });
    const mainMatch = indexRes.data.match(/main\.([a-f0-9]+)\.js/);

    if (!mainMatch) {
        console.log('Could not find main bundle filename');
        return;
    }

    const mainBundleUrl = `https://reg2.kmutnb.ac.th/registrar/${mainMatch[0]}`;
    console.log('Bundle URL:', mainBundleUrl);

    const bundleRes = await axios.get(mainBundleUrl, { httpsAgent: agent });
    const code = bundleRes.data;

    console.log(`Bundle size: ${(code.length / 1024 / 1024).toFixed(1)} MB`);

    // Search for API-related patterns
    console.log('\n=== Searching for API patterns ===\n');

    // Pattern 1: URLs with "api" or "login"
    const apiPatterns = [
        /["']([^"']*(?:api|login|evaluat|assess)[^"']*?)["']/gi,
    ];

    const found = new Set();

    for (const pattern of apiPatterns) {
        let match;
        while ((match = pattern.exec(code)) !== null) {
            const url = match[1];
            // Filter out CSS, JS, and common false positives
            if (url.length > 3 && url.length < 200 &&
                !url.includes('.css') && !url.includes('.js') &&
                !url.includes('font') && !url.includes('svg') &&
                !url.includes('googleapis') && !url.includes('cdn') &&
                !url.match(/^[a-z]$/) && !url.match(/^\d+$/) &&
                !url.includes('node_modules')) {
                found.add(url);
            }
        }
    }

    console.log(`Found ${found.size} potential API/eval/login URLs:\n`);
    const sorted = [...found].sort();
    sorted.forEach(url => console.log(`  ${url}`));

    // Also search for "regapiweb" patterns
    console.log('\n=== Searching for regapiweb patterns ===\n');
    const regapiPattern = /["']([^"']*regapiweb[^"']*?)["']/gi;
    const regapiUrls = new Set();
    let regMatch;
    while ((regMatch = regapiPattern.exec(code)) !== null) {
        regapiUrls.add(regMatch[1]);
    }
    console.log(`Found ${regapiUrls.size} regapiweb URLs:`);
    [...regapiUrls].sort().forEach(url => console.log(`  ${url}`));

    // Search for "Evaluat" controller patterns
    console.log('\n=== Searching for Evaluation controller patterns ===\n');
    const evalPattern = /["']([^"']*[Ee]valuat[a-zA-Z/]*?)["']/gi;
    const evalUrls = new Set();
    let evalMatch;
    while ((evalMatch = evalPattern.exec(code)) !== null) {
        evalUrls.add(evalMatch[1]);
    }
    console.log(`Found ${evalUrls.size} evaluation-related strings:`);
    [...evalUrls].sort().forEach(url => console.log(`  ${url}`));

    // Search for POST/PUT patterns near evaluation
    console.log('\n=== Searching for save/submit evaluation patterns ===\n');
    // Find context around "evaluat" mentions
    const contextPattern = /(.{0,100}[Ee]valuat[a-zA-Z]*.{0,100})/g;
    let ctxMatch;
    const contexts = [];
    while ((ctxMatch = contextPattern.exec(code)) !== null) {
        const ctx = ctxMatch[1];
        if (ctx.includes('http') || ctx.includes('api') || ctx.includes('post') ||
            ctx.includes('save') || ctx.includes('submit') || ctx.includes('url')) {
            contexts.push(ctx);
        }
    }
    console.log(`Found ${contexts.length} interesting evaluation contexts:`);
    contexts.forEach((ctx, i) => console.log(`  [${i}] ${ctx.replace(/\n/g, ' ').substring(0, 200)}`));
}

findAPIs().catch(console.error);
