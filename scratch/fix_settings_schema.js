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

async function testUpsert() {
  console.log('Testing reading settings...');
  const { data, error } = await supabase.from('settings').select('*');
  console.log('Select settings result:', { data, error });

  console.log('Testing upserting payment_methods...');
  const { data: upData, error: upErr } = await supabase.from('settings').upsert({
    id: 'requisites',
    phone: '+7 (960) 837-47-06',
    card_number: '11111111111111111111',
    bank_name: 'Т-Банк / Сбербанк',
    recipient: 'Скокова Юлия Павловна',
    payment_methods: [
      {
        id: 'sbp_1',
        type: 'sbp',
        title: 'Перевод через СБП (по телефону)',
        phone: '+7 (960) 837-47-06',
        bank_name: 'Т-Банк / Сбербанк',
        recipient: 'Скокова Юлия Павловна',
        is_active: true
      },
      {
        id: 'card_1',
        type: 'card',
        title: 'Перевод по номеру карты',
        card_number: '11111111111111111111',
        bank_name: 'Т-Банк / Сбербанк',
        recipient: 'Скокова Юлия Павловна',
        is_active: true
      }
    ]
  });

  console.log('Upsert result:', { upData, upErr });
}

testUpsert();
