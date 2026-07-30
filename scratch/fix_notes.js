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

async function fixNotes() {
  const bookingId = '899fda82-1dc0-4548-80cd-6a77988a2a74';
  
  console.log('Fixing admin notes for booking:', bookingId);
  const { error } = await supabase
    .from('bookings')
    .update({ admin_notes: 'Привет' })
    .eq('id', bookingId);
  
  if (error) {
    console.error('Error updating booking:', error);
  } else {
    console.log('Successfully updated admin_notes to "Привет"');
  }
}

fixNotes();
