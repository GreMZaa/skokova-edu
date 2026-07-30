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

async function testSafeUpsert() {
  const paymentMethods = [
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
  ];

  const firstSbp = paymentMethods.find(m => m.type === 'sbp');
  const firstCard = paymentMethods.find(m => m.type === 'card');

  const mainPhone = firstSbp ? firstSbp.phone : '+7 (926) 123-45-67';
  const mainCard = firstCard ? firstCard.card_number : '';
  const mainBank = firstSbp ? firstSbp.bank_name : 'Т-Банк / Сбербанк';
  const mainRecipient = firstSbp ? firstSbp.recipient : 'Скокова Юлия Павловна';

  // 1. Try with payment_methods column
  let { error } = await supabase.from('settings').upsert({
    id: 'requisites',
    phone: mainPhone,
    card_number: mainCard,
    bank_name: mainBank,
    recipient: mainRecipient,
    payment_methods: paymentMethods,
    updated_at: new Date().toISOString()
  });

  if (error && error.code === 'PGRST204') {
    console.log('Column payment_methods missing, falling back to standard columns...');
    const fallbackRes = await supabase.from('settings').upsert({
      id: 'requisites',
      phone: mainPhone,
      card_number: mainCard,
      bank_name: mainBank,
      recipient: mainRecipient,
      updated_at: new Date().toISOString()
    });
    console.log('Fallback upsert result:', fallbackRes);
  }

  // Also save in user_metadata for persistence
  const { data: usersData } = await supabase.auth.admin.listUsers();
  if (usersData?.users) {
    for (const u of usersData.users) {
      await supabase.auth.admin.updateUserById(u.id, {
        user_metadata: {
          ...u.user_metadata,
          payment_requisites: {
            phone: mainPhone,
            card_number: mainCard,
            bank_name: mainBank,
            recipient: mainRecipient
          },
          payment_methods: paymentMethods
        }
      });
    }
    console.log('Saved to user_metadata for all users!');
  }
}

testSafeUpsert();
