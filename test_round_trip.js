// Test full round trip
import { combineDateTimeToISO, getTimeFromISO } from './src/utils/timezone.js';

console.log('=== FULL ROUND-TRIP TEST ===');

// Step 1: User enters time
const userInput = { date: '2025-11-25', time: '19:00' };
console.log(`1. User enters: ${userInput.time} on ${userInput.date} (Amsterdam time)`);

// Step 2: Convert to UTC for storage
const utcForStorage = combineDateTimeToISO(userInput.date, userInput.time);
console.log(`2. Convert to UTC: ${utcForStorage}`);

// Step 3: Database stores UTC (simulated)
console.log(`3. Database stores: ${utcForStorage}`);

// Step 4: Retrieve and display back to user
const displayTime = getTimeFromISO(utcForStorage);
console.log(`4. Display back to user: ${displayTime}`);

// Result
console.log();
console.log('RESULT:');
if (displayTime === userInput.time) {
  console.log(`✅ SUCCESS: User enters ${userInput.time} → User sees ${displayTime}`);
} else {
  console.log(`❌ PROBLEM: User enters ${userInput.time} → User sees ${displayTime}`);
  console.log('This means the round trip is broken');
}

console.log();
console.log('Expected flow:');
console.log('19:00 Amsterdam → 18:00 UTC (storage) → 19:00 Amsterdam (display)');