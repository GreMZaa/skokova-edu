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

async function inspectAndFix() {
  console.log('Fetching all bookings from database...');
  const { data: bookings, error } = await supabase.from('bookings').select('*, time_slots!bookings_slot_id_fkey(start_time)');
  
  if (error) {
    console.error('Error:', error);
    return;
  }

  for (const b of bookings) {
    console.log('Booking ID:', b.id);
    console.log('Slot ID:', b.slot_id);
    console.log('Joined time_slots start_time:', b.time_slots?.start_time);
    
    // Always compute clean dateStr from slot's start_time!
    if (b.time_slots?.start_time) {
      const d = new Date(b.time_slots.start_time);
      const dayStr = d.toLocaleDateString('ru-RU', { timeZone: 'Europe/Samara', day: 'numeric', month: 'long', weekday: 'short' });
      const timeStr = d.toLocaleTimeString('ru-RU', { timeZone: 'Europe/Samara', hour: '2-digit', minute: '2-digit' });
      const cleanDateStr = `${dayStr}, ${timeStr}`;
      
      console.log('Computed clean dateStr:', cleanDateStr);
    }
  }
}

inspectAndFix();
