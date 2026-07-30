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

async function testStore() {
  console.log('Testing storing requisites in Supabase...');
  
  // We can create a dedicated profiles entry or settings table entry
  const requisitesData = {
    phone: '+7 (926) 123-45-67',
    card_number: '2202 2000 1234 5678',
    bank_name: 'Т-Банк / Сбербанк',
    recipient: 'Скокова Юлия Павловна'
  };

  // Check if we can upsert into profiles with id = '00000000-0000-0000-0000-000000000000'
  const { data, error } = await supabase.from('profiles').upsert({
    id: '00000000-0000-0000-0000-000000000000',
    full_name: requisitesData.recipient,
    phone: requisitesData.phone,
    telegram_handle: JSON.stringify(requisitesData),
  });

  if (error) {
    console.error('Profiles store error:', error);
  } else {
    console.log('Successfully stored requisites in profiles table!');
  }
}

testStore();
