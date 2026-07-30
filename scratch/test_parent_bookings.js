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

async function testQuery() {
  const userId = '2e8cd545-271d-4061-b18f-a21e4c6ac091';
  
  console.log('Querying with explicit relationship time_slots!bookings_slot_id_fkey:');
  const { data: d1, error: e1 } = await supabase
    .from('bookings')
    .select('*, time_slots!bookings_slot_id_fkey(start_time)')
    .eq('user_id', userId);
  
  console.log('Error:', e1);
  console.log('Data:', JSON.stringify(d1, null, 2));
}

testQuery();
