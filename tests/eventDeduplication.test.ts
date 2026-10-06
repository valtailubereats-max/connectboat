import assert from 'node:assert/strict';
import test from 'node:test';
import {
  canonicalizeEventUrl,
  generateEventDedupeKey,
  normalizeEventCity,
  normalizeEventTitle,
  normalizeEventVenue,
} from '../src/utils/eventDeduplication.ts';

test('event text normalization removes accents, punctuation and repeated whitespace', () => {
  assert.equal(normalizeEventTitle('  São  Pedro’s — Boat Show! '), 'sao pedro s boat show');
  assert.equal(normalizeEventCity('SOUTHAMPTON '), 'southampton');
  assert.equal(normalizeEventVenue(' Marina & Yacht Club '), 'marina and yacht club');
});

test('event URL canonicalization removes common tracking data', () => {
  assert.equal(
    canonicalizeEventUrl('https://www.Example.com/events/show/?utm_source=newsletter&b=2&a=1#tickets'),
    'https://example.com/events/show?a=1&b=2',
  );
  assert.equal(canonicalizeEventUrl('example.com/event/'), 'https://example.com/event');
  assert.equal(canonicalizeEventUrl('not a url'), '');
});

test('dedupe key uses normalized title, date and city', () => {
  assert.equal(
    generateEventDedupeKey('South Coast Regatta!', '2027-06-14', 'Portsmouth'),
    'south coast regatta|2027-06-14|portsmouth',
  );
});

