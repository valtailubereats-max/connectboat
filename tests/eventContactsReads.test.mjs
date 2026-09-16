import assert from 'node:assert/strict';
import { readEventContacts } from '../src/server/readEventContacts.mjs';

const records = Array.from({ length: 624 }, (_, i) => ({ id: `contact-${i}`, email: `contact${i}@boat.test`, notes: 'Keep', photoUrl: 'photo.jpg' }));
const byId = new Map(records.map(record => [record.id, record]));
const collection = { doc: id => ({ id }) };
let directReads = 0, fullScans = 0;
const tx = {
  async getAll(...refs) {
    directReads += refs.length;
    return refs.map(ref => ({ id: ref.id, exists: byId.has(ref.id), data: () => byId.get(ref.id) }));
  },
  async get(ref) {
    assert.equal(ref, collection);
    fullScans++;
    return { docs: records.map(record => ({ id: record.id, data: () => record })) };
  },
};
for (let i = 0; i < records.length; i += 25) {
  const page = records.slice(i, i + 25);
  const existing = await readEventContacts(tx, collection, page.map(record => record.id));
  assert.deepEqual(existing, page);
}
assert.equal(directReads, 624);
assert.equal(fullScans, 0);
const fallback = await readEventContacts(tx, collection, ['sheet-unknown', 'contact-1']);
assert.equal(fullScans, 1);
assert.equal(fallback.length, 624);
assert.equal(fallback.find(record => record.id === 'contact-1').notes, 'Keep');
assert.equal(fallback.find(record => record.id === 'contact-1').photoUrl, 'photo.jpg');
const readsBefore = directReads;
assert.deepEqual(await readEventContacts(tx, collection, []), []);
assert.equal(directReads, readsBefore);
assert.equal(fullScans, 1);
await readEventContacts(tx, collection, ['contact-1', 'contact-1']);
assert.equal(directReads, readsBefore + 1);
assert.equal(fullScans, 1);
console.log('Passed: 624 direct reads across 26 pages, no full scans for known IDs, unknown-ID comparison preserved, empty pages and duplicate IDs avoid extra reads.');
