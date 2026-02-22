const https = require('https');
const axios = require('axios');
const fs = require('fs');

const agent = new https.Agent({ rejectUnauthorized: false });
const BASE = 'https://reg2.kmutnb.ac.th/regapiweb3/th/';

async function main() {
    console.log('Fetching main page...');
    const page = await axios.get(BASE, { httpsAgent: agent, headers: { 'User-Agent': 'Mozilla/5.0' }, validateStatus: () => true });

    // Find script tags
    const scripts = [...page.data.matchAll(/src=\"([^\"]+\.js[^\"]*)\"/g)].map(m => m[1]);
    console.log('Found scripts:', scripts);

    for (const src of scripts) {
        let url = src;
        if (!url.startsWith('http')) {
            url = BASE + url;
        }
        console.log('Downloading', url);
        try {
            const resp = await axios.get(url, { httpsAgent: agent, headers: { 'User-Agent': 'Mozilla/5.0' }, validateStatus: () => true });

            const content = resp.data.toString();
            if (content.match(/Addanswer/i)) {
                console.log('\n\n==== FOUND Addanswer IN', src, '====\n');
                const idx = content.search(/Addanswer/i);
                console.log(content.substring(Math.max(0, idx - 300), idx + 500));
            }
            if (content.match(/Evaluateofficerform\/commit/i)) {
                console.log('\n\n==== FOUND commit IN', src, '====\n');
                const idx = content.search(/Evaluateofficerform\/commit/i);
                console.log(content.substring(Math.max(0, idx - 300), idx + 500));
            }
        } catch (e) {
            console.error('Failed to download', url, e.message);
        }
    }
}
main().catch(console.error);
