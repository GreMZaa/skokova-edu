const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

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
const supabase = createClient(supabaseUrl, serviceKey);

async function testLink() {
  const { data, error } = await supabase.auth.admin.generateLink({
    type: 'recovery',
    email: 'lev-drakon2010@mail.ru',
    options: {
      redirectTo: 'https://skokova-edu.vercel.app/login?reset=true',
    },
  });

  if (error) {
    console.error('Error:', error);
  } else {
    const rawLink = data.properties?.action_link;
    console.log('Raw link from Supabase:', rawLink);

    // Подставляем реальный прод домен вместо localhost
    const fixedLink = rawLink.replace(/redirect_to=[^&]+/, 'redirect_to=' + encodeURIComponent('https://skokova-edu.vercel.app/login?reset=true'));
    console.log('Fixed link for Email:', fixedLink);
  }
}

testLink();
