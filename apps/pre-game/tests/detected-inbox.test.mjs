import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const source = readFileSync(resolve('app/components/PreGameApp.tsx'), 'utf8');

const requiredMarkers = [
  'type Screen = "list" | "detected"',
  'interface DetectedActivity',
  'pg_detected_activities',
  'DETECTED ACTIVITY INBOX',
  'Gmail recruiter reply',
  'Google Calendar interview',
  'Indeed application confirmation',
  'Client lead email',
  'Follow-up reminder',
  'LOG IT',
  'IGNORE',
  'LINK TO OPPORTUNITY',
  'MARK AS INCOME',
  'REMIND ME',
  'type PassiveFrequency = "weekly" | "biweekly" | "monthly" | "annual"',
  'Passive recurring',
  'RECURRING',
  'PASSIVE',
  'weekly × 52 · biweekly × 26 · monthly × 12 · annual × 1',
];

const missing = requiredMarkers.filter((marker) => !source.includes(marker));

if (missing.length) {
  console.error('Missing detected inbox markers:');
  for (const marker of missing) console.error(`- ${marker}`);
  process.exit(1);
}

console.log('Detected inbox source markers present.');
