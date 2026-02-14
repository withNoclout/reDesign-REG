require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
    console.error('❌ DATABASE_URL is missing in .env.local');
    console.error('Please make sure you have DATABASE_URL set in your environment variables.');
    process.exit(1);
}

const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
});

async function addRLSPolicies() {
    try {
        await client.connect();
        console.log('✅ Connected to Supabase Database');

        // Policy 1: Service Role Full Access (bypass RLS for server-side operations)
        console.log('\n📝 Adding Policy: Service Role Full Access...');
        try {
            await client.query(`
                DROP POLICY IF EXISTS "Service Role Full Access" ON news_items;
            `);
            await client.query(`
                CREATE POLICY "Service Role Full Access" ON news_items
                FOR ALL
                USING (auth.role() = 'service_role')
                WITH CHECK (auth.role() = 'service_role');
            `);
            console.log('✅ Service Role Full Access policy created');
        } catch (err) {
            console.warn('⚠️  Warning creating Service Role Full Access:', err.message);
        }

        // Policy 2: Users can insert their own data
        console.log('\n📝 Adding Policy: User Insert Own...');
        try {
            await client.query(`
                DROP POLICY IF EXISTS "User Insert Own" ON news_items;
            `);
            await client.query(`
                CREATE POLICY "User Insert Own" ON news_items
                FOR INSERT
                WITH CHECK (auth.uid()::text = created_by);
            `);
            console.log('✅ User Insert Own policy created');
        } catch (err) {
            console.warn('⚠️  Warning creating User Insert Own:', err.message);
        }

        // Policy 3: Users can update their own data
        console.log('\n📝 Adding Policy: User Update Own...');
        try {
            await client.query(`
                DROP POLICY IF EXISTS "User Update Own" ON news_items;
            `);
            await client.query(`
                CREATE POLICY "User Update Own" ON news_items
                FOR UPDATE
                USING (auth.uid()::text = created_by)
                WITH CHECK (auth.uid()::text = created_by);
            `);
            console.log('✅ User Update Own policy created');
        } catch (err) {
            console.warn('⚠️  Warning creating User Update Own:', err.message);
        }

        // Policy 4: Users can delete their own data
        console.log('\n📝 Adding Policy: User Delete Own...');
        try {
            await client.query(`
                DROP POLICY IF EXISTS "User Delete Own" ON news_items;
            `);
            await client.query(`
                CREATE POLICY "User Delete Own" ON news_items
                FOR DELETE
                USING (auth.uid()::text = created_by);
            `);
            console.log('✅ User Delete Own policy created');
        } catch (err) {
            console.warn('⚠️  Warning creating User Delete Own:', err.message);
        }

        // Verify policies were created
        console.log('\n🔍 Verifying RLS policies...');
        const result = await client.query(`
            SELECT 
                policyname,
                permissive,
                roles,
                cmd,
                qual,
                with_check
            FROM pg_policies 
            WHERE tablename = 'news_items'
            ORDER BY policyname;
        `);

        if (result.rows.length > 0) {
            console.log('\n✅ RLS Policies in news_items table:');
            result.rows.forEach(row => {
                const cmdType = {
                    'r': 'SELECT',
                    'a': 'INSERT',
                    'w': 'UPDATE',
                    'd': 'DELETE'
                };
                const cmds = row.cmd ? row.cmd.split('').map(c => cmdType[c] || c).join(', ') : 'ALL';
                console.log(`   - ${row.policyname}: ${cmds}`);
                console.log(`     Roles: ${row.roles}`);
                console.log(`     Permissive: ${row.permissive ? 'Yes' : 'No'}`);
                console.log('');
            });
        } else {
            console.log('\n⚠️  Warning: No policies found in the table');
        }

        // Check if RLS is enabled
        console.log('🔍 Checking RLS status...');
        const rlsResult = await client.query(`
            SELECT relrowsecurity 
            FROM pg_class 
            WHERE relname = 'news_items';
        `);

        if (rlsResult.rows.length > 0) {
            const rlsEnabled = rlsResult.rows[0].relrowsecurity;
            console.log(`✅ RLS is ${rlsEnabled ? 'ENABLED' : 'DISABLED'} on news_items table`);
        }

        console.log('\n🎉 RLS Policies setup completed successfully!');
        console.log('\n📝 Summary of policies created:');
        console.log('   1. Service Role Full Access - Server can do any operation');
        console.log('   2. User Insert Own - Users can insert their own data');
        console.log('   3. User Update Own - Users can update their own data');
        console.log('   4. User Delete Own - Users can delete their own data');
        console.log('\n📝 Next steps:');
        console.log('   1. The portfolio upload feature should now work');
        console.log('   2. Test by uploading a portfolio item from the web app');
        console.log('   3. Verify data is being stored in Supabase');
        console.log('\n💡 Note: If you still get errors, check that:');
        console.log('   - Your API routes are using getServiceSupabase()');
        console.log('   - The service role key is correctly set in .env.local');
        console.log('   - The user is authenticated when making requests');

    } catch (err) {
        console.error('\n❌ Error:', err.message);
        console.error('\n📋 Full error details:', err);

        console.log('\n🔄 Fallback: Manual SQL to run in Supabase Dashboard');
        console.log('   If the script failed, you can manually run these SQL commands:');
        console.log('   https://supabase.com/dashboard > Your Project > SQL Editor');
        console.log('\n   1. Service Role Full Access:');
        console.log('      CREATE POLICY "Service Role Full Access" ON news_items');
        console.log('      FOR ALL');
        console.log('      USING (auth.role() = \'service_role\')');
        console.log('      WITH CHECK (auth.role() = \'service_role\');');
        console.log('\n   2. User Insert Own:');
        console.log('      CREATE POLICY "User Insert Own" ON news_items');
        console.log('      FOR INSERT');
        console.log('      WITH CHECK (auth.uid()::text = created_by);');
        console.log('\n   3. User Update Own:');
        console.log('      CREATE POLICY "User Update Own" ON news_items');
        console.log('      FOR UPDATE');
        console.log('      USING (auth.uid()::text = created_by)');
        console.log('      WITH CHECK (auth.uid()::text = created_by);');
        console.log('\n   4. User Delete Own:');
        console.log('      CREATE POLICY "User Delete Own" ON news_items');
        console.log('      FOR DELETE');
        console.log('      USING (auth.uid()::text = created_by);');

        process.exit(1);
    } finally {
        await client.end();
        console.log('\n✅ Database connection closed');
    }
}

addRLSPolicies();