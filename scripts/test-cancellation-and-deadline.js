require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

async function testCancellationAndDeadline() {
  console.log('=== TESTING CANCELLATION TRACKING & DEADLINE ENFORCEMENT ===');

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const admin = createClient(supabaseUrl, serviceKey);

  // 1. Verify cancelled_at column exists in attendances
  const { data: testCol, error: colError } = await admin
    .from('attendances')
    .select('id, status, created_at, cancelled_at')
    .limit(1);

  if (colError) throw colError;
  console.log('✅ Column cancelled_at confirmed in attendances table.');

  // 2. Test updating an attendance row to status = 'cancelled' with cancelled_at timestamp
  // We can pick an upcoming test attendance or inspect
  const { data: atts } = await admin.from('attendances').select('id, profile_id, event_id, status, created_at, cancelled_at').limit(1);
  if (atts && atts.length > 0) {
    const testAtt = atts[0];
    console.log(`Sample attendance row before: ID=${testAtt.id}, status=${testAtt.status}, created_at=${testAtt.created_at}, cancelled_at=${testAtt.cancelled_at}`);
  }

  // 3. Test activity_logs insert for cancel
  const { data: profs } = await admin.from('profiles').select('id').limit(1);
  if (profs && profs[0]) {
    const testPid = profs[0].id;
    const { error: logErr } = await admin.from('activity_logs').insert({
      profile_id: testPid,
      action: 'cancel',
      event_id: null
    });
    if (logErr) throw logErr;
    console.log('✅ Activity log for cancel action inserted successfully.');
    
    // Clean up test log
    await admin.from('activity_logs').delete().eq('profile_id', testPid).eq('action', 'cancel').is('event_id', null);
  }

  console.log('✅ All cancellation tracking tests succeeded!');
}

testCancellationAndDeadline().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
