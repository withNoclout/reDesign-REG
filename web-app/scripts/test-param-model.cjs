const axios = require('axios');
const https = require('https');

const agent = new https.Agent({ rejectUnauthorized: false });

async function findParamModel() {
    // Download the EvaluateofficerformModule chunk (5628) which has the Addanswer calls
    const runtimeRes = await axios.get('https://reg2.kmutnb.ac.th/registrar/runtime.8032b599bea53fcc.js', { httpsAgent: agent });
    const hash5628 = /5628:"([a-f0-9]+)"/.exec(runtimeRes.data)?.[1];
    const hash5226 = /5226:"([a-f0-9]+)"/.exec(runtimeRes.data)?.[1];
    const hash6166 = /6166:"([a-f0-9]+)"/.exec(runtimeRes.data)?.[1];

    const chunks = [];
    if (hash5628) chunks.push({ id: '5628', hash: hash5628 });
    if (hash5226) chunks.push({ id: '5226', hash: hash5226 });
    if (hash6166) chunks.push({ id: '6166', hash: hash6166 });

    for (const chunk of chunks) {
        const url = `https://reg2.kmutnb.ac.th/registrar/${chunk.id}.${chunk.hash}.js`;
        console.log(`\n=== Chunk ${chunk.id} ===`);
        const res = await axios.get(url, { httpsAgent: agent });
        const code = res.data;

        // Look for the Addanswer HTTP call context with more surrounding code
        const addPattern = /(.{0,300}Addanswer.{0,300})/g;
        let m;
        while ((m = addPattern.exec(code)) !== null) {
            console.log(`\nAddanswer context:`);
            console.log(m[1]);
        }

        // Look for the frm.value usage context
        const frmPattern = /(.{0,200}frm\.value.{0,200})/g;
        while ((m = frmPattern.exec(code)) !== null) {
            console.log(`\nfrm.value context:`);
            console.log(m[1]);
        }

        // Look for generateform or FormGroup creation
        const formGroupPattern = /(.{0,300}generateform.{0,300})/g;
        while ((m = formGroupPattern.exec(code)) !== null) {
            console.log(`\ngenerateform context:`);
            console.log(m[1]);
        }

        // Look for the requestService usage (the HTTP interceptor)
        const reqSvcPattern = /(.{0,200}requestService.{0,200})/g;
        while ((m = reqSvcPattern.exec(code)) !== null) {
            if (m[1].includes('post') || m[1].includes('get') || m[1].includes('http')) {
                console.log(`\nrequestService context:`);
                console.log(m[1]);
            }
        }
    }
}

findParamModel().catch(console.error);
