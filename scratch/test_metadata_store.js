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

async function testMetadataStore() {
  console.log('Testing saving requisites in Supabase Auth user_metadata...');
  const { data: usersData } = await supabase.auth.admin.listUsers();
  
  if (usersData && usersData.users.length > 0) {
    const firstUser = usersData.users[0];
    const requisites = {
      phone: '+7 (926) 123-45-67',
      card_number: '2202 2000 1234 5678',
      bank_name: 'Т-Банк / Сбербанк',
      recipient: 'Скокова Юлия Павловна'
    };

    const { data: updated, error } = await supabase.auth.admin.updateUserById(firstUser.id, {
      user_metadata: { ...firstUser.user_metadata, payment_requisites: requisites }
    });

    if (error) {
      console.error('Error saving user metadata:', error);
    } else {
      console.log('Successfully saved payment_requisites in Supabase Auth metadata!');
      console.log('Saved data:', updated.user.user_metadata.payment_requisites);
    }
  }
}

testMetadataStore();
