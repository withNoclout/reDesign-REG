// Deep dive into reg2 bundle to find the actual API URL constructor
const axios = require('axios');
const https = require('https');

const agent = new https.Agent({ rejectUnauthorized: false });

async function deepDive() {
    const bundleRes = await axios.get('https://reg2.kmutnb.ac.th/registrar/main.efd0e6ba14d8dbbf.js', { httpsAgent: agent });
    const code = bundleRes.data;

    // Find apiUrl and environment config
    console.log('=== 1. Environment/apiUrl Config ===');
    const envPattern = /apiUrl[:\s=]*["']([^"']+)["']/gi;
    let m;
    while ((m = envPattern.exec(code)) !== null) {
        console.log(`  apiUrl = "${m[1]}"`);
    }

    // Find /regapiweb context
    console.log('\n=== 2. /regapiweb context ===');
    const regapiContextPattern = /.{0,200}\/regapiweb.{0,200}/g;
    while ((m = regapiContextPattern.exec(code)) !== null) {
        console.log(`  Context: ...${m[0].substring(0, 300)}...`);
    }

    // Find the Evaluateofficer lazy loaded chunk numbers
    console.log('\n=== 3. Evaluateofficer module chunks ===');
    // EvaluateofficerModule = chunk 6332
    // EvaluateofficerformModule = chunk 5226+5628

    // Now let's load those lazy chunks to find the actual API calls
    const evalChunks = ['6332', '5628', '5226', '6166'];

    for (const chunkId of evalChunks) {
        console.log(`\n--- Chunk ${chunkId} ---`);
        try {
            // Try common chunk filename patterns
            const patterns = [
                `https://reg2.kmutnb.ac.th/registrar/${chunkId}.*.js`,
            ];

            // First, find the actual filename from the runtime
            const runtimeRes = await axios.get('https://reg2.kmutnb.ac.th/registrar/runtime.8032b599bea53fcc.js', { httpsAgent: agent });
            const runtimeCode = runtimeRes.data;

            // Find chunk hash mapping
            const chunkHashPattern = new RegExp(`${chunkId}:"([a-f0-9]+)"`, 'g');
            let hashMatch = chunkHashPattern.exec(runtimeCode);

            if (hashMatch) {
                const hash = hashMatch[1];
                const chunkUrl = `https://reg2.kmutnb.ac.th/registrar/${chunkId}.${hash}.js`;
                console.log(`  URL: ${chunkUrl}`);

                const chunkRes = await axios.get(chunkUrl, { httpsAgent: agent });
                const chunkCode = chunkRes.data;
                console.log(`  Size: ${(chunkCode.length / 1024).toFixed(1)} KB`);

                // Search for API paths in chunk
                const apiInChunk = /["']((?:\/[A-Za-z]+)+(?:\?[^"']*)?)["']/g;
                const found = new Set();
                let cm;
                while ((cm = apiInChunk.exec(chunkCode)) !== null) {
                    if (cm[1].length > 3 && cm[1].length < 150 &&
                        !cm[1].includes('.css') && !cm[1].includes('.js') &&
                        !cm[1].includes('svg')) {
                        found.add(cm[1]);
                    }
                }

                console.log(`  API paths found:`)
                found.forEach(p => console.log(`    ${p}`));

                // Search for HTTP method patterns
                const httpPatterns = /\.(get|post|put|delete)\s*\(\s*[^)]*?(evaluat|Evaluat)[^)]*?\)/g;
                let httpMatch;
                while ((httpMatch = httpPatterns.exec(chunkCode)) !== null) {
                    console.log(`  HTTP call: ${httpMatch[0].substring(0, 200)}`);
                }

                // Also search for string concatenation with evaluate
                const concatPattern = /.{0,100}[Ee]valuat[a-zA-Z]*.{0,100}/g;
                let concatMatch;
                const contexts = [];
                while ((concatMatch = concatPattern.exec(chunkCode)) !== null) {
                    const ctx = concatMatch[0];
                    if (ctx.includes('http') || ctx.includes('.get') || ctx.includes('.post') ||
                        ctx.includes('save') || ctx.includes('url') || ctx.includes('api') ||
                        ctx.includes('this.') || ctx.includes('Service')) {
                        contexts.push(ctx);
                    }
                }
                if (contexts.length > 0) {
                    console.log(`  Evaluation contexts:`)
                    contexts.forEach((c, i) => console.log(`    [${i}] ${c.substring(0, 250)}`));
                }
            } else {
                console.log(`  Hash not found in runtime`);
            }
        } catch (e) {
            console.log(`  Error: ${e.message}`);
        }
    }
}

deepDive().catch(console.error);
