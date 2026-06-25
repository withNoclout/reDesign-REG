
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
    console.log('Checking students table...');
    const { data, error } = await supabase
        .from('students')
        .select('*');

    if (error) {
        console.error('Error:', error.message);
    } else {
        console.log(`Found ${data.length} records in students.`);
        if (data.length > 0) {
            console.log('Sample student:', JSON.stringify(data[0], null, 2));
        }
    }
}

check();
