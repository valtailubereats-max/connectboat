import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const pageSource = readFileSync(new URL('../src/pages/AdminEventsFound.tsx', import.meta.url), 'utf8');
const adminEventsSource = readFileSync(new URL('../src/pages/AdminFotos.tsx', import.meta.url), 'utf8');
const appSource = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');
const rulesSource = readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8');

test('Events Found has a separate admin route and keeps Add Event', () => {
  assert.match(appSource, /path="\/admin\/events-found"/);
  assert.match(adminEventsSource, />\s*Add Event\s*</);
  assert.match(adminEventsSource, /Events Found/);
});

test('externalEventCandidates is admin-only in Firestore rules', () => {
  assert.match(
    rulesSource,
    /match \/externalEventCandidates\/\{candidateId\}[\s\S]*?allow read, create, update, delete: if isAdmin\(\);/,
  );
});

test('approval is transactional, deterministic and publishes a standard unpaid event', () => {
  assert.match(pageSource, /runTransaction\(db/);
  assert.match(pageSource, /if \(current\.publishedEventId\)/);
  assert.match(pageSource, /`imported_\$\{candidate\.id\}`/);
  assert.match(pageSource, /plan: 'standard'/);
  assert.match(pageSource, /paymentStatus: 'not_required'/);
  assert.match(pageSource, /approvalStatus: 'approved'/);
  assert.match(pageSource, /status: 'published'/);
  assert.match(pageSource, /active: true/);
});

test('candidate edit writes only to externalEventCandidates', () => {
  assert.match(pageSource, /updateDoc\(doc\(db, COLLECTION_NAME, editing\.id\)/);
  assert.match(pageSource, /Candidate updated\. No public event was created\./);
});

