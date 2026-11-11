import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const vercel = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'));
const emailHandler = readFileSync(new URL('../api/email/send.ts', import.meta.url), 'utf8');

test('analytics public route is rewritten to the existing email function before the API catch-all', () => {
  const rewrites = vercel.rewrites as Array<{ source: string; destination: string }>;
  const analyticsIndex = rewrites.findIndex((rule) => rule.source === '/api/analytics/ad-events');
  const catchAllIndex = rewrites.findIndex((rule) => rule.source === '/api/(.*)');

  assert.ok(analyticsIndex >= 0);
  assert.ok(catchAllIndex > analyticsIndex);
  assert.equal(rewrites[analyticsIndex].destination, '/api/email/send?channel=ad-analytics');
  assert.match(emailHandler, /req\.query\?\.channel === 'ad-analytics'/);
  assert.match(emailHandler, /return adAnalyticsHandler\(req, res\)/);
});
