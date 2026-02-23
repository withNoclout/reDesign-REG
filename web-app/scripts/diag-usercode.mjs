
import axios from 'axios';
import https from 'https';
import zlib from 'zlib';
import { promisify } from 'util';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const gunzip = promisify(zlib.gunzip);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env.local') });

const username = process.env.REG_USERNAME;
const password = process.env.REG_PASSWORD;
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function diagnostic() {
    console.log(`Diagnosing for ${username}...`);
    const agent = new https.Agent({ rejectUnauthorized: false });

    // 1. Login to get the REAL usercode from university JSON
    const loginRes = await axios.post('https://reg4.kmutnb.ac.th/regapiweb2/api/th/Account/LoginAD',
        { username, password }, // This script is simpler than the real one but let's see if it works
        { httpsAgent: agent, validateStatus: () => true });

    // Actually, let's just use the s-prefix vs non-s-prefix directly for testing
    const stdCodeWithS = username.startsWith('s') ? username : 's' + username;
    const stdCodeWithoutS = username.startsWith('s') ? username.substring(1) : username;

    console.log(`Testing with S: ${stdCodeWithS}`);
    console.log(`Testing without S: ${stdCodeWithoutS}`);

    const checkDB = async (code) => {
        const { data, error } = await supabase
            .from('evaluation_submissions')
            .select('*')
            .eq('user_code', code);
        return data || [];
    };

    const recordsS = await checkDB(stdCodeWithS);
    const recordsNoS = await checkDB(stdCodeWithoutS);

    console.log(`Records found with S: ${recordsS.length}`);
    console.log(`Records found without S: ${recordsNoS.length}`);

    if (recordsNoS.length > 0) {
        console.log('Sample record without S:', recordsNoS[0]);
    }
}

diagnostic();
