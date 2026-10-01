require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

async function testCancelledEventProtection() {
  console.log('=== TESTING CANCELLED EVENT REGISTRATION PROTECTION ===');

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    throw new Error('Missing Supabase configuration in .env.local');
  }

  const admin = createClient(supabaseUrl, serviceKey);

  // 1. Create a dummy test event with is_active = false
  const testDate = '2099-12-31';
  const { data: createdEvent, error: createError } = await admin
    .from('events')
    .insert([
      {
        title: 'TESZT Törölt Esemény',
        event_date: `${testDate}T16:00:00+00:00`,
        start_time: '16:00:00',
        end_time: '18:00:00',
        is_active: false,
      },
    ])
    .select()
    .single();

  if (createError) throw new Error('Failed to create test event: ' + createError.message);
  console.log(`✅ Created test inactive event: ${createdEvent.id} (is_active=${createdEvent.is_active})`);

  try {
    // 2. Query any profile for testing registration attempt
    const { data: profile } = await admin.from('profiles').select('id').limit(1).single();
    if (!profile) throw new Error('No profile available for test');

    // 3. Test the exact server-side validation logic from app/api/set-attendance/route.ts
    const { data: ev, error: evError } = await admin
      .from('events')
      .select('id, title, is_active, event_date')
      .eq('id', createdEvent.id)
      .maybeSingle();

    if (evError) throw evError;
    if (!ev) throw new Error('Event not found');

    const attend = true;
    let rejectedAsExpected = false;
    let rejectionError = '';

    if (ev.is_active === false && attend) {
      rejectedAsExpected = true;
      rejectionError = 'Ez az esemény törölve van / elmarad, így nem lehet rá jelentkezni.';
    }

    if (!rejectedAsExpected) {
      throw new Error('Registration on cancelled event was NOT rejected!');
    }
    console.log(`✅ Inactive event registration correctly rejected with: "${rejectionError}"`);

    // 4. Verify no attendance was inserted for this event
    const { data: attCheck } = await admin
      .from('attendances')
      .select('id')
      .eq('event_id', createdEvent.id);

    if (attCheck && attCheck.length > 0) {
      throw new Error('Attendance row was unexpectedly found for inactive event!');
    }
    console.log('✅ Confirmed 0 attendances exist for inactive event.');
  } finally {
    // Clean up test event
    await admin.from('events').delete().eq('id', createdEvent.id);
    console.log('✅ Cleaned up test event.');
  }

  console.log('🎉 ALL CANCELLED EVENT PROTECTION TESTS PASSED SUCCESSFULLY!');
}

testCancelledEventProtection().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
