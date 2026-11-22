import test from 'node:test';
import assert from 'node:assert/strict';
import { addPlanDuration, getPlanDurationDays } from '../src/utils/planDuration.ts';

const settings = { planDurations: { standard: 31, featured: 45, premium: 60, marketplace: 75, service: 90 } };

test('each paid tier reads its independent Admin duration', () => {
  assert.equal(getPlanDurationDays(settings, 'standard', 'Boats for Sale'), 31);
  assert.equal(getPlanDurationDays(settings, 'featured', 'Boats for Sale'), 45);
  assert.equal(getPlanDurationDays(settings, 'premium', 'Boats for Sale'), 60);
});

test('Boat Services always use service duration, regardless of boat plan durations', () => {
  assert.equal(getPlanDurationDays(settings, 'standard', 'Boat Parts'), 75);
  assert.equal(getPlanDurationDays(settings, 'standard', 'Boat Services'), 90);
  assert.equal(getPlanDurationDays(settings, 'featured', 'Boat Services'), 90);
  assert.equal(getPlanDurationDays(settings, 'premium', 'Boat Services'), 90);
});

test('voucher and courtesy durations override plan defaults', () => {
  assert.equal(getPlanDurationDays(settings, 'premium', 'Boats for Sale', 14), 14);
  assert.equal(getPlanDurationDays(settings, 'standard', 'Boat Services', 7), 7);
});

test('missing Boat Services setting uses safe default instead of a boat plan duration', () => {
  assert.equal(getPlanDurationDays({ planDurations: { standard: 30, featured: 44, premium: 66 } }, 'featured', 'Boat Services'), 30);
});

test('renewal dates are computed from activation time and preserve current dates unless invoked', () => {
  const start = new Date('2026-01-01T00:00:00.000Z');
  assert.equal(addPlanDuration(start, 31).toISOString(), '2026-02-01T00:00:00.000Z');
  assert.equal(start.toISOString(), '2026-01-01T00:00:00.000Z');
});
