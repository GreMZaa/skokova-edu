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

async function testReschedule() {
  const bookingId = '899fda82-1dc0-4548-80cd-6a77988a2a74';
  
  // Date: 2026-07-30, Time: 15:00 (Samara UTC+4)
  // Samara 15:00 = 11:00 UTC
  const newStartTimeISO = '2026-07-30T11:00:00.000Z'; // 15:00 Samara
  const newEndTimeISO = '2026-07-30T11:40:00.000Z';   // 15:40 Samara (40 mins)

  console.log('1. Checking if slot exists for', newStartTimeISO);
  let { data: slot } = await supabase
    .from('time_slots')
    .select('*')
    .eq('start_time', newStartTimeISO)
    .maybeSingle();

  if (!slot) {
    console.log('Slot not found, creating new slot...');
    const { data: newSlot, error: createErr } = await supabase
      .from('time_slots')
      .insert({
        start_time: newStartTimeISO,
        end_time: newEndTimeISO,
        is_booked: true,
      })
      .select()
      .single();
    
    if (createErr) {
      console.error('Failed to create slot:', createErr);
      return;
    }
    slot = newSlot;
  } else {
    console.log('Slot found:', slot.id, 'Marking is_booked = true');
    await supabase.from('time_slots').update({ is_booked: true, locked_until: null }).eq('id', slot.id);
  }

  // Get old slot_id from booking
  const { data: booking } = await supabase.from('bookings').select('slot_id').eq('id', bookingId).single();
  const oldSlotId = booking?.slot_id;

  console.log('Old slot_id:', oldSlotId, 'New slot_id:', slot.id);

  // Update booking to new slot_id
  const { error: updateErr } = await supabase
    .from('bookings')
    .update({
      slot_id: slot.id,
      status: 'rescheduled',
      updated_at: new Date().toISOString(),
    })
    .eq('id', bookingId);

  if (updateErr) {
    console.error('Update booking error:', updateErr);
    return;
  }

  // Free old slot if different
  if (oldSlotId && oldSlotId !== slot.id) {
    console.log('Freeing old slot:', oldSlotId);
    await supabase.from('time_slots').update({ is_booked: false, locked_until: null }).eq('id', oldSlotId);
  }

  console.log('Reschedule complete successfully!');
}

testReschedule();
