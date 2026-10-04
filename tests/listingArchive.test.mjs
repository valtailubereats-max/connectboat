import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { isCurrentlyArchived } from '../src/utils/listingArchive.ts';
import { collectFirebaseStoragePaths, deleteFirebaseStoragePaths, firebaseStoragePathFromUrl } from '../src/utils/firebaseStorageMedia.ts';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('My Listings archives and restores without changing commercial or expiry fields', () => {
  const profile = read('src/pages/Profile.tsx');
  const archiveBlock = profile.slice(profile.indexOf('const handleArchiveAd'), profile.indexOf('const handleRelistAd'));

  assert.match(archiveBlock, /archivedAt:\s*serverTimestamp\(\)/);
  assert.match(archiveBlock, /archivedBy:\s*user\.uid/);
  assert.match(archiveBlock, /const handleRestoreAd/);
  assert.match(archiveBlock, /restoredAt:\s*serverTimestamp\(\)/);
  assert.doesNotMatch(archiveBlock, /archivedAt:\s*null/);
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
  assert.match(adsRules, /request\.resource\.data\.restoredAt == request\.time/);
  assert.match(adsRules, /request\.resource\.data\.get\('archivedAt', null\) == resource\.data\.get\('archivedAt', null\)/);
  assert.match(adsRules, /allow delete: if isAdmin\(\);/);
  assert.doesNotMatch(adsRules, /allow delete:[\s\S]*resource\.data\.get\('sellerId'/);
});

test('admin archived filter recognises the new archive flag and keeps permanent delete explicit', () => {
  const admin = read('src/pages/AdminAds.tsx');
  assert.match(admin, /adFilter === 'archived'[\s\S]*isCurrentlyArchived\(ad\)/);
  assert.match(admin, /permanently delete this listing/i);
  assert.match(admin, /Archived \(\$\{stats\.archived\}\)/);
  assert.match(admin, /deletedListingAudits/);
  assert.match(admin, /listingSnapshot:\s*ad/);
  assert.match(admin, /deleteListingMedia/);
  assert.match(admin, /deleteObject\(ref\(storage, path\)\)/);
});

test('Permanent Delete resolves encoded Firebase URLs, deduplicates media and excludes external URLs', () => {
  const bucket = 'connectboat.firebasestorage.app';
  const encoded = `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/ads%2FMsvzgpwC2EYSQwYQMyWZ7DgspVm2%2F1791118904206_Mascote%20ConnectBoat.png?alt=media&token=test`;
  const second = `https://storage.googleapis.com/${bucket}/ads/owner/second-image.jpg`;
  const gumtree = 'https://img.gumtree.com/example/external.jpg';

  assert.equal(
    firebaseStoragePathFromUrl(encoded, bucket),
    'ads/MsvzgpwC2EYSQwYQMyWZ7DgspVm2/1791118904206_Mascote ConnectBoat.png'
  );
  assert.deepEqual(
    collectFirebaseStoragePaths([encoded, encoded, second, gumtree], bucket),
    [
      'ads/MsvzgpwC2EYSQwYQMyWZ7DgspVm2/1791118904206_Mascote ConnectBoat.png',
      'ads/owner/second-image.jpg'
    ]
  );
  assert.equal(firebaseStoragePathFromUrl(gumtree, bucket), null);
});

test('Permanent Delete does not silently accept Storage failures and deletes Firestore last', () => {
  const admin = read('src/pages/AdminAds.tsx');
  const flow = admin.slice(admin.indexOf('const deleteListingMedia'), admin.indexOf('const handleDeleteAd'));
  assert.match(flow, /deleteFirebaseStoragePaths/);
  assert.ok(flow.indexOf('await setDoc(auditRef') < flow.indexOf('await deleteListingMedia(ad)'));
  assert.ok(flow.indexOf('await deleteListingMedia(ad)') < flow.indexOf("await deleteDoc(doc(db, 'ads', ad.id))"));

  const storageRules = read('storage.rules');
  assert.match(storageRules, /allow delete: if isAuthenticated\(\) && \(request\.auth\.uid == userId \|\| isAdmin\(\)\)/);
});

test('Storage deletion failure rejects instead of reporting Permanent Delete success', async () => {
  await assert.rejects(
    deleteFirebaseStoragePaths(
      ['ads/owner/ok.jpg', 'ads/owner/fails.jpg'],
      async path => {
        if (path.endsWith('fails.jpg')) throw Object.assign(new Error('unauthorized'), { code: 'storage/unauthorized' });
      }
    ),
    /listing was not deleted because 1 Storage file\(s\) could not be removed: ads\/owner\/fails\.jpg/
  );
});

test('current archive state overrides historical archivedAt and legacy status fallback', () => {
  assert.equal(isCurrentlyArchived({ isArchived: true, status: 'approved', adStatus: 'active' }), true);
  assert.equal(isCurrentlyArchived({ isArchived: false, archivedAt: new Date(), status: 'archived' }), false);
  assert.equal(isCurrentlyArchived({ status: 'archived' }), true);
  assert.equal(isCurrentlyArchived({ status: 'approved', adStatus: 'active' }), false);
});

test('Admin restore preserves archive history and does not extend expiry or alter payment', () => {
  const admin = read('src/pages/AdminAds.tsx');
  const restoreBlock = admin.slice(admin.indexOf('const handleRestoreArchivedAd'), admin.indexOf('const categoryFilterOptions'));
  assert.match(restoreBlock, /isArchived:\s*false/);
  assert.match(restoreBlock, /restoredAt:\s*serverTimestamp\(\)/);
  assert.doesNotMatch(restoreBlock, /archivedAt\s*:/);
  assert.doesNotMatch(restoreBlock, /expirationDate\s*:/);
  assert.doesNotMatch(restoreBlock, /planExpiresAt\s*:/);
  assert.doesNotMatch(restoreBlock, /paymentStatus\s*:/);
  assert.match(admin, /isCurrentlyArchived\(selectedAd\)[\s\S]*handleRestoreArchivedAd\(selectedAd\)[\s\S]*<span>Restore<\/span>/);
});

test('Archived count and ACTIVE badge use only the canonical current-state helper', () => {
  const admin = read('src/pages/AdminAds.tsx');
  assert.match(admin, /archived:\s*ads\.filter\(isCurrentlyArchived\)\.length/);
  assert.match(admin, /!isCurrentlyArchived\(ad\) && ad\.adStatus/);
  assert.match(admin, /Status:\s*\{isCurrentlyArchived\(selectedAd\) \? 'archived' : selectedAd\.status\}/);
});

test('Manage Listings cards show the stored category with existing legacy hire aliases', () => {
  const admin = read('src/pages/AdminAds.tsx');
  assert.match(admin, /Category:\s*\{getAdminCategoryLabel\(ad\.category\)\}/);
  assert.match(admin, /Stored category:\s*\$\{String\(ad\.category/);
  assert.match(admin, /'Aluguer de Barcos':\s*'Boats for Hire'/);
  assert.match(admin, /'Boat Hire & Charters':\s*'Boats for Hire'/);
  assert.match(admin, /legacyCategoryLabels\[storedCategory\] \|\| storedCategory/);
});
