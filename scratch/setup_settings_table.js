const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envLocal = fs.readFileSync('.env.local', 'utf8');
const envVars = {};
envLocal.split('\n').forEach(line => {
  const [key, ...val] = line.split('=');
  if (key && val) {
    envVars[key.trim()] = val.join('=').trim().replace(/^["']|["']$/g, '');
  }
});

const supabaseUrl = envVars.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = envVars.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function setupSettingsTable() {
  console.log('Checking settings table in Supabase DB...');
  
  // Try querying settings table
  const { data, error } = await supabase.from('settings').select('*');
  
  if (error) {
    console.log('Settings table does not exist or error:', error.message);
    console.log('Inserting default requisites using upsert fallback if table created...');
  } else {
    console.log('Settings table exists! Current settings:', data);
  }
}

setupSettingsTable();
