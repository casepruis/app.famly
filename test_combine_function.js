// Test the combineDateTimeToISO function specifically
import { combineDateTimeToISO } from './src/utils/timezone.js';

console.log("=== TESTING combineDateTimeToISO FUNCTION ===");
console.log();

// Test scenario: User in Amsterdam enters "2025-11-25 19:00" for dinner
const testDate = "2025-11-25";
const testTime = "19:00";

console.log("Input from AI assistant:");
console.log(`Date: ${testDate}`);
console.log(`Time: ${testTime}`);
console.log("User expects this to mean 19:00 Amsterdam time");

const result = combineDateTimeToISO(testDate, testTime);

console.log();
console.log("Result from combineDateTimeToISO:");
console.log(`Output: ${result}`);

console.log();
console.log("Analysis:");
if (result) {
    const resultDate = new Date(result);
    console.log(`UTC time stored: ${resultDate.toISOString()}`);
    console.log(`Amsterdam time (what user should see): ${resultDate.toLocaleString('en-GB', { timeZone: 'Europe/Amsterdam', hour12: false })}`);
    
    // Check if Amsterdam display matches what user entered
    const amsterdamTime = resultDate.toLocaleString('en-GB', { 
        timeZone: 'Europe/Amsterdam', 
        hour12: false,
        hour: '2-digit',
        minute: '2-digit'
    }).split(', ')[1]; // Extract just the time part
    
    console.log();
    if (amsterdamTime === testTime) {
        console.log("✅ SUCCESS: User enters 19:00 → sees 19:00");
    } else {
        console.log(`❌ PROBLEM: User enters ${testTime} → sees ${amsterdamTime}`);
    }
} else {
    console.log("❌ Function returned null");
}