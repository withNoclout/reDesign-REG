
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function check() {
    const { data, error } = await supabase
        .from('evaluation_submissions')
        .select('*')
        .order('submitted_at', { ascending: false });

    if (error) {
        console.error('Error:', error.message);
    } else {
        console.log(`Found ${data.length} records in evaluation_submissions.`);
        data.forEach((row, i) => {
            console.log(`Record ${i + 1}:`, JSON.stringify(row, null, 2));
        });
    }
}

check();
