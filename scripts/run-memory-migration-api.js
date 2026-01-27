/**
 * Run Memory System Migration via Supabase Management API
 * Uses the Supabase Management API to execute SQL migrations
 */

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
const accessToken = envVars.SUPABASE_ACCESS_TOKEN;

if (!supabaseUrl) {
  console.error('❌ Missing VITE_SUPABASE_URL in .env');
  process.exit(1);
}

if (!accessToken) {
  console.error('❌ Missing SUPABASE_ACCESS_TOKEN in .env');
  console.error('   Get it from: https://supabase.com/dashboard/account/tokens');
  process.exit(1);
}

// Extract project ref from URL
const projectRef = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1];
if (!projectRef) {
  console.error('❌ Could not extract project ref from Supabase URL');
  process.exit(1);
}

// Get migration file from command line argument or default
const migrationArg = process.argv[2];
const migrationFile = migrationArg || '20260128_memory_system.sql';
const migrationPath = join(__dirname, '..', 'supabase', 'migrations', migrationFile);

let migrationSQL;
try {
  migrationSQL = readFileSync(migrationPath, 'utf-8');
} catch (error) {
  console.error(`❌ Migration file not found: ${migrationPath}`);
  console.error('   Usage: node run-memory-migration-api.js [migration_file.sql]');
  process.exit(1);
}

console.log('🚀 Running Migration via Supabase Management API...');
console.log('📋 Project:', projectRef);
console.log('📄 Migration file:', migrationPath);
console.log('');

async function runMigration() {
  try {
    // Use Supabase Management API to execute SQL
    // API endpoint: https://api.supabase.com/v1/projects/{ref}/database/query
    const apiUrl = `https://api.supabase.com/v1/projects/${projectRef}/database/query`;

    console.log('📤 Sending migration to Supabase Management API...');

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: migrationSQL,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Migration failed:');
      console.error(`   Status: ${response.status} ${response.statusText}`);
      console.error(`   Error: ${errorText}`);
      
      // If it's a 401, the token might be invalid
      if (response.status === 401) {
        console.error('');
        console.error('💡 Your access token might be invalid or expired.');
        console.error('   Get a new one from: https://supabase.com/dashboard/account/tokens');
      }
      
      process.exit(1);
    }

    const result = await response.json();
    
    console.log('✅ Migration executed successfully!');
    console.log('');
    console.log('📊 Result:', JSON.stringify(result, null, 2));
    console.log('');
    console.log('🎉 Memory system tables created:');
    console.log('   ✓ conversation_summaries');
    console.log('   ✓ user_context_profiles');
    console.log('   ✓ memory_fragments');
    console.log('');
    console.log('✨ All indexes, triggers, and permissions have been set up.');
    
  } catch (error) {
    console.error('❌ Error executing migration:', error.message);
    console.error('');
    console.error('💡 Alternative: Run the SQL manually in Supabase Dashboard:');
    console.error('   https://supabase.com/dashboard/project/' + projectRef + '/sql/new');
    process.exit(1);
  }
}

runMigration();
