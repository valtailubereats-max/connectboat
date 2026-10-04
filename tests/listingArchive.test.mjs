import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('My Listings archives and restores without changing commercial or expiry fields', () => {
  const profile = read('src/pages/Profile.tsx');
  const archiveBlock = profile.slice(profile.indexOf('const handleArchiveAd'), profile.indexOf('const handleRelistAd'));

  assert.match(archiveBlock, /archivedAt:\s*serverTimestamp\(\)/);
  assert.match(archiveBlock, /archivedBy:\s*user\.uid/);
  assert.match(archiveBlock, /const handleRestoreAd/);
  assert.doesNotMatch(archiveBlock, /deleteDoc\(doc\(db, 'ads'/);
  assert.doesNotMatch(archiveBlock, /expirationDate\s*:/);
  assert.doesNotMatch(archiveBlock, /planExpiresAt\s*:/);
  assert.doesNotMatch(archiveBlock, /paymentStatus\s*:/);
});

test('archived listings are excluded from public marketplace and related listings', () => {
  const home = read('src/pages/Home.tsx');
  const details = read('src/pages/AdDetails.tsx');

  assert.match(home, /ad\.isHidden \|\| ad\.isArchived/);
  assert.match(home, /!ad\.isHidden && !ad\.isArchived && ad\.status === 'approved'/);
  assert.match(details, /adData\.isHidden \|\| adData\.isArchived/);
  assert.match(details, /item\.isHidden \|\| item\.isArchived/);
});

test('Firestore allows timestamp-bound owner archive updates but permanent deletion is admin-only', () => {
  const rules = read('firestore.rules');
  const adsRules = rules.slice(rules.indexOf('match /ads/{adId}'), rules.indexOf('match /courtesyListingCredits'));

  assert.match(adsRules, /request\.resource\.data\.archivedAt == request\.time/);
  assert.match(adsRules, /request\.resource\.data\.archivedBy == request\.auth\.uid/);
  assert.match(adsRules, /allow delete: if isAdmin\(\);/);
  assert.doesNotMatch(adsRules, /allow delete:[\s\S]*resource\.data\.get\('sellerId'/);
});

test('admin archived filter recognises the new archive flag and keeps permanent delete explicit', () => {
  const admin = read('src/pages/AdminAds.tsx');
  assert.match(admin, /adFilter === 'archived'[\s\S]*ad\.isArchived === true/);
  assert.match(admin, /permanently delete this listing/i);
  assert.match(admin, /Archived \(\$\{stats\.archived\}\)/);
  assert.match(admin, /deletedListingAudits/);
  assert.match(admin, /listingSnapshot:\s*ad/);
  assert.match(admin, /deleteListingMedia/);
  assert.match(admin, /deleteObject\(ref\(storage, url\)\)/);
});

test('Manage Listings cards show the stored category with existing legacy hire aliases', () => {
  const admin = read('src/pages/AdminAds.tsx');
  assert.match(admin, /Category:\s*\{getAdminCategoryLabel\(ad\.category\)\}/);
  assert.match(admin, /Stored category:\s*\$\{String\(ad\.category/);
  assert.match(admin, /'Aluguer de Barcos':\s*'Boats for Hire'/);
  assert.match(admin, /'Boat Hire & Charters':\s*'Boats for Hire'/);
  assert.match(admin, /legacyCategoryLabels\[storedCategory\] \|\| storedCategory/);
});
