/**
 * Quick test script to verify Supabase connection
 * Run with: node test-supabase-connection.js
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Read .env file
const envContent = readFileSync(join(__dirname, '.env'), 'utf-8');
const envVars = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^([^#=]+)=(.*)$/);
  if (match) {
    const key = match[1].trim();
    const value = match[2].trim().replace(/^["']|["']$/g, '');
    envVars[key] = value;
  }
});

const supabaseUrl = envVars.VITE_SUPABASE_URL;
const supabaseKey = envVars.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials in .env');
  process.exit(1);
}

console.log('🔗 Testing Supabase connection...');
console.log('URL:', supabaseUrl);

const supabase = createClient(supabaseUrl, supabaseKey);

async function testConnection() {
  try {
    // Test 1: Check if users table exists
    console.log('\n📊 Test 1: Checking users table...');
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('count')
      .limit(1);
    
    if (usersError) {
      console.error('❌ Error accessing users table:', usersError.message);
      return false;
    }
    console.log('✅ Users table accessible');

    // Test 2: Check sessions table
    console.log('\n📊 Test 2: Checking sessions table...');
    const { data: sessions, error: sessionsError } = await supabase
      .from('sessions')
      .select('count')
      .limit(1);
    
    if (sessionsError) {
      console.error('❌ Error accessing sessions table:', sessionsError.message);
      return false;
    }
    console.log('✅ Sessions table accessible');

    // Test 3: Check messages table
    console.log('\n📊 Test 3: Checking messages table...');
    const { data: messages, error: messagesError } = await supabase
      .from('messages')
      .select('count')
      .limit(1);
    
    if (messagesError) {
      console.error('❌ Error accessing messages table:', messagesError.message);
      return false;
    }
    console.log('✅ Messages table accessible');

    // Test 4: Check user_preferences table
    console.log('\n📊 Test 4: Checking user_preferences table...');
    const { data: prefs, error: prefsError } = await supabase
      .from('user_preferences')
      .select('count')
      .limit(1);
    
    if (prefsError) {
      console.error('❌ Error accessing user_preferences table:', prefsError.message);
      return false;
    }
    console.log('✅ User preferences table accessible');

    console.log('\n🎉 All tables are accessible! Supabase connection is working.');
    return true;
  } catch (error) {
    console.error('❌ Unexpected error:', error);
    return false;
  }
}

testConnection().then(success => {
  process.exit(success ? 0 : 1);
});
