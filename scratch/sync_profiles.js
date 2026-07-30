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

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function syncProfiles() {
  console.log('Fetching users from auth.users...');
  const { data: usersData, error: usersErr } = await supabase.auth.admin.listUsers();
  if (usersErr) {
    console.error('Failed to list users:', usersErr);
    return;
  }

  console.log(`Found ${usersData.users.length} users in Supabase Auth:`);
  for (const user of usersData.users) {
    console.log(`User: ${user.id} (${user.email})`);

    // Fetch existing bookings to get full_name, phone, telegram_handle if available
    const { data: userBookings } = await supabase
      .from('bookings')
      .select('parent_name, phone, telegram_handle')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    const latestBooking = userBookings && userBookings[0] ? userBookings[0] : {};

    const profileData = {
      id: user.id,
      full_name: latestBooking.parent_name || user.user_metadata?.full_name || 'Родитель',
      phone: latestBooking.phone || '',
      telegram_handle: latestBooking.telegram_handle || '',
    };

    console.log('Upserting profile for user:', profileData);
    const { error: upsertErr } = await supabase.from('profiles').upsert(profileData);
    if (upsertErr) {
      console.error('Upsert profile error:', upsertErr);
    } else {
      console.log('Successfully created/updated profile for user:', user.email);
    }
  }
}

syncProfiles();
