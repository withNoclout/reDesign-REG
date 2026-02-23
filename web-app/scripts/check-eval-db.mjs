
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing Supabase credentials in .env.local');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function check() {
    console.log('Checking evaluation_submissions table...');
    const { data, error } = await supabase
        .from('evaluation_submissions')
        .select('*');

    if (error) {
        console.error('Error fetching data:', error.message);
        if (error.code === '42P01') {
            console.error('TABLE DOES NOT EXIST! Did the user run the SQL script?');
        }
    } else {
        console.log(`Found ${data.length} records in evaluation_submissions.`);
        if (data.length > 0) {
            console.log('Sample record:', JSON.stringify(data[0], null, 2));
        }
    }
}

check();
