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

async function testTableAccess() {
  console.log('Testing reading from settings table...');
  const { data: dbSettings, error: selectErr } = await supabase
    .from('settings')
    .select('*')
    .eq('id', 'requisites')
    .maybeSingle();

  if (selectErr) {
    console.log('Table settings does not exist yet:', selectErr.message);
  } else {
    console.log('Settings table exists! Data:', dbSettings);
  }
}

testTableAccess();
