// Test our timezone conversion functions
import { getTimeFromISO, getDateFromISO } from './src/utils/timezone.js';

console.log("=== FRONTEND TIMEZONE CONVERSION TEST ===");
console.log();

// Test with the actual events from database
const events = [
    { title: "Etentje op werk", start_time: "2025-11-28T18:00:00+00:00", end_time: "2025-11-28T21:00:00+00:00" },
    { title: "Etentje met werk", start_time: "2025-11-26T19:00:00+00:00", end_time: "2025-11-26T22:00:00+00:00" },
    { title: "Etentje op het werk", start_time: "2025-11-25T18:00:00+00:00", end_time: "2025-11-25T21:00:00+00:00" }
];

console.log("Database UTC times -> What should show in Events page:");
events.forEach(event => {
    const startTime = getTimeFromISO(event.start_time);
    const endTime = getTimeFromISO(event.end_time);
    const date = getDateFromISO(event.start_time);
    
    console.log(`${event.title}: ${startTime} - ${endTime} on ${date}`);
});

console.log();
console.log("Expected results for Amsterdam users (UTC+1):");
console.log("Etentje op werk: 19:00 - 22:00");
console.log("Etentje met werk: 20:00 - 23:00");  
console.log("Etentje op het werk: 19:00 - 22:00");