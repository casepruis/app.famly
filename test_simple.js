// Simple test of the timezone issue
console.log('Testing timezone conversion:');
console.log('Browser timezone:', Intl.DateTimeFormat().resolvedOptions().timeZone);

// Simulate what happens when user enters 14:00
const testDate = '2025-11-24';
const testTime = '14:00';
const dateTimeStr = `${testDate}T${testTime}:00`;

console.log('Input datetime string:', dateTimeStr);

const localDate = new Date(dateTimeStr);
console.log('Parsed as Date object:', localDate);
console.log('Local time string:', localDate.toLocaleString());
console.log('ISO string (UTC):', localDate.toISOString());

// This is what gets stored in the database
const stored = localDate.toISOString();

// This is what should happen when displaying
const retrieved = new Date(stored);
console.log('Retrieved from DB:', retrieved);
console.log('Displayed as local:', retrieved.toLocaleString());