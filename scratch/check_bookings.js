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

async function checkBookings() {
  console.log('Fetching all bookings from database...');
  const { data: bookings, error } = await supabase.from('bookings').select('*');
  if (error) {
    console.error('Error fetching bookings:', error);
    return;
  }
  console.log(`Found ${bookings.length} bookings:`);
  console.log(JSON.stringify(bookings, null, 2));
}

checkBookings();
