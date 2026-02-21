const axios = require('axios');
const https = require('https');

const agent = new https.Agent({ rejectUnauthorized: false });

async function grepBundleForList() {
    // We already found chunk 6332 is EvaluateofficerModule (the list module)
    try {
        const runtimeRes = await axios.get('https://reg2.kmutnb.ac.th/registrar/runtime.8032b599bea53fcc.js', { httpsAgent: agent });
        const hashMatch = /6332:"([a-f0-9]+)"/.exec(runtimeRes.data);
        if (!hashMatch) return console.log('Chunk hash not found');

        const chunkUrl = `https://reg2.kmutnb.ac.th/registrar/6332.${hashMatch[1]}.js`;
        console.log(`Downloading: ${chunkUrl}`);

        const chunkRes = await axios.get(chunkUrl, { httpsAgent: agent });
        const code = chunkRes.data;

        // Let's log all strings that look like API endpoints or parts of it
        const strRegex = /["']([^"'<>]{4,200})["']/g;
        let m;
        const matches = new Set();
        while ((m = strRegex.exec(code))) {
            const str = m[1];
            // Filter common UI strings to isolate API paths
            if (!str.includes(' ') &&
                !str.includes('evaluateofficerform') &&  // already found
                (str.includes('/') || str.includes('Get') || str.includes('List') || str.toLowerCase().includes('evaluat'))) {
                matches.add(str);
            }
        }

        console.log('\nPotential API strings in EvaluateofficerModule:');
        Array.from(matches).sort().forEach(s => console.log(`  ${s}`));

        // Also look at chunk 5628 and 5226 (EvaluateofficerformModule)
        console.log('\nLet\'s check the whole list of API calls...');
        const httpCallRegex = /\.get\s*\(\s*["']([^"']+)["']/g;
        let httpM;
        while ((httpM = httpCallRegex.exec(code))) {
            console.log(`  Found exact GET call: ${httpM[1]}`);
        }

    } catch (e) { console.error(e.message); }
}

grepBundleForList();
