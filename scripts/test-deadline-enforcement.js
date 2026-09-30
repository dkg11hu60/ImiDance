function toDateKey(dateValue) {
  if (!dateValue) return '';
  if (dateValue instanceof Date) {
    const y = dateValue.getFullYear();
    const m = String(dateValue.getMonth() + 1).padStart(2, '0');
    const day = String(dateValue.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }
  const str = String(dateValue).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
  if (str.includes('T')) return str.split('T')[0];
  const d = new Date(str);
  if (!isNaN(d.getTime())) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }
  return str.slice(0, 10);
}

function getRegistrationDeadline(eventDateValue) {
  const dateKey = toDateKey(eventDateValue);
  if (!dateKey) return new Date(0);
  const parts = dateKey.split('-').map(Number);
  if (parts.length < 3 || isNaN(parts[0]) || isNaN(parts[1]) || isNaN(parts[2])) {
    return new Date(0);
  }

  const eventDateUtc = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2], 12, 0, 0));
  const prevDateUtc = new Date(eventDateUtc.getTime() - 24 * 60 * 60 * 1000);
  const prevY = prevDateUtc.getUTCFullYear();
  const prevM = prevDateUtc.getUTCMonth();
  const prevD = prevDateUtc.getUTCDate();
  const prevDateKey = `${prevY}-${String(prevM + 1).padStart(2, '0')}-${String(prevD).padStart(2, '0')}`;

  const testDate = new Date(`${prevDateKey}T12:00:00Z`);
  const budapestHour = parseInt(
    new Intl.DateTimeFormat('en-US', {
      timeZone: 'Europe/Budapest',
      hour: 'numeric',
      hour12: false,
    }).format(testDate),
    10
  );
  const offset = budapestHour - 12;
  const utcHour = 18 - offset;

  return new Date(Date.UTC(prevY, prevM, prevD, utcHour, 0, 0, 0));
}

function isRegistrationOpen(eventDateValue, now = new Date()) {
  const deadline = getRegistrationDeadline(eventDateValue);
  return now.getTime() <= deadline.getTime();
}

console.log('=== REGISTRATION DEADLINE TESTS ===');

// Test 1: Event today (registration must be CLOSED)
const now = new Date();
const todayKey = toDateKey(now);
const isTodayOpen = isRegistrationOpen(todayKey, now);
console.log(`Test 1 - Event Today (${todayKey}): Open? ${isTodayOpen} (Expected: false)`);
if (isTodayOpen !== false) throw new Error('Today event should be closed!');

// Test 2: Event yesterday (registration must be CLOSED)
const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
const yesterdayKey = toDateKey(yesterday);
const isYesterdayOpen = isRegistrationOpen(yesterdayKey, now);
console.log(`Test 2 - Event Yesterday (${yesterdayKey}): Open? ${isYesterdayOpen} (Expected: false)`);
if (isYesterdayOpen !== false) throw new Error('Yesterday event should be closed!');

// Test 3: Event next week (registration must be OPEN)
const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
const nextWeekKey = toDateKey(nextWeek);
const isNextWeekOpen = isRegistrationOpen(nextWeekKey, now);
console.log(`Test 3 - Event Next Week (${nextWeekKey}): Open? ${isNextWeekOpen} (Expected: true)`);
if (isNextWeekOpen !== true) throw new Error('Next week event should be open!');

// Test 4: Event tomorrow at 17:59 preceding day (OPEN) vs 18:01 preceding day (CLOSED)
const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
const tomorrowKey = toDateKey(tomorrow);
const deadlineTomorrow = getRegistrationDeadline(tomorrowKey);

// 1 minute before deadline
const beforeDeadline = new Date(deadlineTomorrow.getTime() - 60 * 1000);
console.log(`Test 4A - 1 min before deadline: Open? ${isRegistrationOpen(tomorrowKey, beforeDeadline)} (Expected: true)`);
if (!isRegistrationOpen(tomorrowKey, beforeDeadline)) throw new Error('Should be open before deadline!');

// 1 minute after deadline
const afterDeadline = new Date(deadlineTomorrow.getTime() + 60 * 1000);
console.log(`Test 4B - 1 min after deadline: Open? ${isRegistrationOpen(tomorrowKey, afterDeadline)} (Expected: false)`);
if (isRegistrationOpen(tomorrowKey, afterDeadline)) throw new Error('Should be closed after deadline!');

console.log('✅ ALL DEADLINE VERIFICATION TESTS PASSED!');
