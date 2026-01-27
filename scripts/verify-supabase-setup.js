/**
 * Verify Supabase Setup
 * Checks database connection and table structure
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Read .env
const envPath = join(__dirname, '..', '.env');
const envContent = readFileSync(envPath, 'utf-8');
const envVars = {};
envContent.split('\n').forEach(line => {
  const trimmed = line.trim();
  if (trimmed && !trimmed.startsWith('#')) {
    const match = trimmed.match(/^([^=]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      let value = match[2].trim();
      // Remove quotes if present
      if ((value.startsWith('"') && value.endsWith('"')) || 
          (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      envVars[key] = value;
    }
  }
});

const supabaseUrl = envVars.VITE_SUPABASE_URL;
const supabaseKey = envVars.VITE_SUPABASE_ANON_KEY;

console.log('🔍 Verifying Supabase Setup...\n');
console.log('URL:', supabaseUrl);
console.log('Key type:', supabaseKey?.includes('service_role') ? '⚠️  SERVICE_ROLE (should be ANON)' : '✅ ANON');

if (!supabaseUrl || !supabaseKey) {
  console.error('\n❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const tables = ['users', 'sessions', 'messages', 'user_preferences'];
const results = {};

async function verifyTables() {
  console.log('\n📊 Verifying tables...\n');
  
  for (const table of tables) {
    try {
      const { data, error } = await supabase
        .from(table)
        .select('*')
        .limit(1);
      
      if (error) {
        console.error(`❌ ${table}:`, error.message);
        results[table] = false;
      } else {
        console.log(`✅ ${table}: Accessible`);
        results[table] = true;
      }
    } catch (error) {
      console.error(`❌ ${table}:`, error.message);
      results[table] = false;
    }
  }
  
  const allPassed = Object.values(results).every(r => r === true);
  
  console.log('\n' + '='.repeat(50));
  if (allPassed) {
    console.log('✅ All tables verified! Setup is complete.');
    console.log('\n📝 Next steps:');
    console.log('   1. Run: npm run dev');
    console.log('   2. Click "Sign In" in the app');
    console.log('   3. Login with Privy');
    console.log('   4. Check Supabase dashboard to see your data');
  } else {
    console.log('❌ Some tables failed verification');
    console.log('   Please check the SQL schema was run correctly');
  }
  console.log('='.repeat(50));
  
  return allPassed;
}

verifyTables().then(success => {
  process.exit(success ? 0 : 1);
});
