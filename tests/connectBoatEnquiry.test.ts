import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { renderEmail } from '../api/email/send.ts';

const createAdSource = readFileSync(new URL('../src/pages/CreateAd.tsx', import.meta.url), 'utf8');
const detailsSource = readFileSync(new URL('../src/pages/AdDetails.tsx', import.meta.url), 'utf8');
const emailSource = readFileSync(new URL('../api/email/send.ts', import.meta.url), 'utf8');

test('ConnectBoat Enquiry is an independent, opt-in listing contact method', () => {
  assert.match(createAdSource, /showEnquiry:\s*prefill\?\.showEnquiry[^\n]+false/);
  assert.match(createAdSource, /showEnquiry:\s*isExternalListingForSave\s*\?\s*false/);
  assert.match(detailsSource, /a\.showEnquiry === true && a\.sellerId/);
  assert.match(detailsSource, /return 'Send Enquiry'/);
});

test('enquiry authentication returns to the listing and never submits a seller email', () => {
  assert.match(detailsSource, /redirect=\$\{encodeURIComponent\(location\.pathname \+ location\.search\)\}/);
  assert.match(detailsSource, /isEnquiry \? \{\} : \{ to: recipient \}/);
  assert.match(emailSource, /prepareSellerEnquiry\(decodedUser, data\)/);
  assert.match(emailSource, /ad\.showEnquiry !== true \|\| !sellerId \|\| isExternal \|\| isUnclaimed/);
});

test('enquiry email escapes user-controlled content', () => {
  const rendered = renderEmail('seller_enquiry', {
    adId: 'boat-1',
    adTitle: '<script>bad()</script>',
    sellerName: 'Seller',
    interestedName: '<b>Buyer</b>',
    interestedEmail: 'buyer@example.test',
    message: '<img src=x onerror=bad()>',
  });

  assert.doesNotMatch(rendered.html, /<script>|<img src=x|<b>Buyer<\/b>/);
  assert.match(rendered.html, /&lt;script&gt;bad\(\)&lt;\/script&gt;/);
  assert.match(rendered.html, /&lt;img src=x onerror=bad\(\)&gt;/);
});

test('server-side spam limits store counters but not enquiry content', () => {
  const helper = emailSource.slice(
    emailSource.indexOf('async function prepareSellerEnquiry'),
    emailSource.indexOf('async function authorizeEmailRequest'),
  );
  assert.match(helper, /enquiryRateLimits/);
  assert.match(helper, /count >= 3/);
  assert.match(helper, /now - lastSentAt < 60 \* 1000/);
  assert.doesNotMatch(helper, /transaction\.set\([^)]*message/);
});
