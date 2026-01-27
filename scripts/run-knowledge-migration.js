/**
 * Run Session Knowledge Migration
 * 
 * Executes the session_knowledge migration SQL using Supabase Management API
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://emdscknuikfzyamthegj.supabase.co';
const supabaseAccessToken = process.env.SUPABASE_ACCESS_TOKEN || 'sbp_373052a475b57dab0ec34a65b30d3248c38fc523';

if (!supabaseAccessToken) {
  console.error('❌ SUPABASE_ACCESS_TOKEN is required');
  console.error('   Set it in your .env file or as an environment variable');
  process.exit(1);
}

// Read migration SQL
const migrationPath = join(__dirname, '..', 'supabase', 'migrations', '20260128_session_knowledge.sql');
let migrationSQL;

try {
  migrationSQL = readFileSync(migrationPath, 'utf-8');
  console.log('✅ Migration file loaded:', migrationPath);
} catch (error) {
  console.error('❌ Failed to read migration file:', error.message);
  process.exit(1);
}

// Extract project reference from URL
const projectRef = supabaseUrl.match(/https?:\/\/([^.]+)\.supabase\.co/)?.[1];
if (!projectRef) {
  console.error('❌ Could not extract project reference from VITE_SUPABASE_URL');
  process.exit(1);
}

console.log('📦 Project Reference:', projectRef);
console.log('🔗 Supabase URL:', supabaseUrl);
console.log('');

// Execute migration using Management API
async function runMigration() {
  try {
    console.log('📤 Executing migration via Supabase Management API...');
    console.log('');

    // Use the Management API to execute SQL
    const response = await fetch(
      `https://api.supabase.com/v1/projects/${projectRef}/database/query`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${supabaseAccessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: migrationSQL,
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Migration failed:', response.status, response.statusText);
      console.error('Response:', errorText);
      
      // If Management API doesn't work, provide alternative instructions
      if (response.status === 401 || response.status === 403) {
        console.log('');
        console.log('⚠️  Management API authentication failed.');
        console.log('📝 Please run the migration using one of these methods:');
        console.log('');
        console.log('1. Supabase Dashboard (Recommended):');
        console.log(`   - Go to: https://supabase.com/dashboard/project/${projectRef}/sql/new`);
        console.log('   - Copy and paste the SQL from: supabase/migrations/20260128_session_knowledge.sql');
        console.log('   - Click "Run"');
        console.log('');
        console.log('2. Supabase CLI:');
        console.log('   npx supabase db push --db-url "postgresql://postgres:[YOUR-PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres"');
        console.log('');
      }
      
      process.exit(1);
    }

    const result = await response.json();
    console.log('✅ Migration executed successfully!');
    console.log('');
    console.log('📊 Result:', JSON.stringify(result, null, 2));
    console.log('');
    console.log('🎉 Session Knowledge tables created:');
    console.log('   - session_knowledge_sources');
    console.log('   - session_knowledge_chunks');
    console.log('   - jina_rate_limit_status');
    console.log('');
    console.log('✨ Functions created:');
    console.log('   - count_session_knowledge_sources');
    console.log('   - search_session_knowledge');
    console.log('   - get_session_knowledge_context');
    console.log('');

  } catch (error) {
    console.error('❌ Error executing migration:', error.message);
    console.log('');
    console.log('📝 Alternative: Run the migration via Supabase Dashboard:');
    console.log(`   https://supabase.com/dashboard/project/${projectRef}/sql/new`);
    process.exit(1);
  }
}

runMigration();
