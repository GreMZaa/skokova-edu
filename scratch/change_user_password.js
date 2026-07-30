const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Читаем .env.local
const envPath = path.join(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  const envConfig = fs.readFileSync(envPath, 'utf8');
  envConfig.split('\n').forEach((line) => {
    const [key, ...value] = line.split('=');
    if (key && value) {
      process.env[key.trim()] = value.join('=').trim().replace(/^["']|["']$/g, '');
    }
  });
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
  console.error('Missing SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey);

async function resetUserPassword() {
  const targetEmail = 'lev-drakon2010@mail.ru';
  const newPassword = 'Skokova-2026';

  console.log(`Searching for user ${targetEmail}...`);
  const { data: usersData, error: listError } = await supabase.auth.admin.listUsers();

  if (listError || !usersData?.users) {
    console.error('Error listing users:', listError);
    return;
  }

  const user = usersData.users.find(
    (u) => u.email?.toLowerCase() === targetEmail.toLowerCase()
  );

  if (!user) {
    console.error(`User ${targetEmail} not found in Supabase Auth!`);
    return;
  }

  console.log(`User found! ID: ${user.id}. Updating password to: ${newPassword}`);
  const { data: updateData, error: updateError } = await supabase.auth.admin.updateUserById(
    user.id,
    { password: newPassword, email_confirm: true }
  );

  if (updateError) {
    console.error('Update password failed:', updateError);
  } else {
    console.log('SUCCESS! Password updated successfully.');
  }
}

resetUserPassword();
