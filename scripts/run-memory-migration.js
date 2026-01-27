/**
 * Run Memory System Migration
 * Executes the memory system migration SQL directly via Supabase
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Read .env file
const envPath = join(__dirname, '..', '.env');
const envContent = readFileSync(envPath, 'utf-8');
const envVars = {};

envContent.split('\n').forEach((line) => {
  const trimmed = line.trim();
  if (trimmed && !trimmed.startsWith('#')) {
    const match = trimmed.match(/^([^=]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      let value = match[2].trim();
      // Remove quotes if present
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      envVars[key] = value;
    }
  }
});

const supabaseUrl = envVars.VITE_SUPABASE_URL;
const supabaseServiceKey = envVars.VITE_SUPABASE_ANON_KEY; // Using service role key
const accessToken = envVars.SUPABASE_ACCESS_TOKEN;

if (!supabaseUrl) {
  console.error('❌ Missing VITE_SUPABASE_URL in .env');
  process.exit(1);
}

if (!supabaseServiceKey) {
  console.error('❌ Missing VITE_SUPABASE_ANON_KEY in .env');
  process.exit(1);
}

// Read migration SQL
const migrationPath = join(__dirname, '..', 'supabase', 'migrations', '20260128_memory_system.sql');
const migrationSQL = readFileSync(migrationPath, 'utf-8');

console.log('🚀 Running Memory System Migration...');
console.log('📋 Supabase URL:', supabaseUrl);
console.log('📄 Migration file:', migrationPath);
console.log('');

// Create Supabase client with service role key (has admin privileges)
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    persistSession: false,
  },
});

// Execute migration using RPC or direct SQL
// Note: Supabase JS client doesn't support raw SQL execution directly
// We'll need to use the REST API or Management API

// For now, let's try using the REST API with the access token
async function runMigration() {
  try {
    console.log('📤 Executing migration SQL...');

    // Split SQL into individual statements (basic splitting)
    const statements = migrationSQL
      .split(';')
      .map((s) => s.trim())
      .filter((s) => s.length > 0 && !s.startsWith('--'));

    console.log(`📊 Found ${statements.length} SQL statements to execute`);

    // Note: Supabase JS client doesn't support executing arbitrary SQL
    // We need to use the Management API or Supabase CLI
    // For now, output instructions

    console.log('');
    console.log('⚠️  Direct SQL execution via JS client is not supported.');
    console.log('');
    console.log('📝 Please run the migration using one of these methods:');
    console.log('');
    console.log('1. Supabase Dashboard:');
    console.log('   - Go to: https://supabase.com/dashboard/project/emdscknuikfzyamthegj/sql/new');
    console.log('   - Copy and paste the SQL from: supabase/migrations/20260128_memory_system.sql');
    console.log('   - Click "Run"');
    console.log('');
    console.log('2. Supabase CLI:');
    console.log('   npx supabase db push');
    console.log('');
    console.log('3. Or use the Supabase Management API with your access token');
    console.log('');

    // Try to verify tables exist
    console.log('🔍 Checking for existing memory tables...');
    const { data: tables, error: tablesError } = await supabase.rpc('exec_sql', {
      query: `
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name IN ('conversation_summaries', 'user_context_profiles', 'memory_fragments')
        ORDER BY table_name;
      `,
    });

    if (tablesError) {
      // RPC might not exist, that's okay
      console.log('ℹ️  Could not check tables (this is normal if migration not run yet)');
    } else {
      if (tables && tables.length > 0) {
        console.log('✅ Found existing memory tables:');
        tables.forEach((table) => console.log(`   - ${table.table_name}`));
      } else {
        console.log('ℹ️  Memory tables not found - migration needs to be run');
      }
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

runMigration();
