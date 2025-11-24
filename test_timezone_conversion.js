// Quick test of timezone conversion
import { combineDateTimeToISO } from './src/utils/timezone.js';

console.log('Testing timezone conversion:');
console.log('Current timezone:', Intl.DateTimeFormat().resolvedOptions().timeZone);

// Test: User wants to schedule at 14:00 today
const testDate = '2025-11-24';
const testTime = '14:00';

console.log('Input:', `${testDate} ${testTime}`);

const result = combineDateTimeToISO(testDate, testTime);
console.log('Output (UTC):', result);

// Parse it back to see what time it represents
const parsedBack = new Date(result);
console.log('Parsed back (local):', parsedBack.toLocaleString());
console.log('Parsed back (UTC):', parsedBack.toISOString());