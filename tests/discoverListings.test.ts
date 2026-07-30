import {
  normalizeListingUrl,
  extractExternalId,
  validateSearchPageUrl
} from '../src/utils/urlNormalization.js';
import {
  discoverApolloDuckListings,
  discoverBoatsAndOutboardsListings
} from '../api/discover-listings.js';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
  console.log(`✓ ${message}`);
}

async function runTests() {
  console.log('--- RUNNING SEARCH PAGE DISCOVERY UNIT TESTS ---');

  // 1. URL Normalization
  const norm1 = normalizeListingUrl('http://WWW.APOLLODUCK.CO.UK/boat/test/123?utm_source=google&ref=123#top');
  assert(norm1 === 'https://www.apolloduck.co.uk/boat/test/123', 'HTTPS enforcement, lowercase host, tracking param & fragment removal');

  const normRelative = normalizeListingUrl('/boat/sessa-34/811335', 'https://www.apolloduck.co.uk/boats/power');
  assert(normRelative === 'https://www.apolloduck.co.uk/boat/sessa-34/811335', 'Relative URL resolution');

  // 2. External ID Extraction
  const idApollo = extractExternalId('https://www.apolloduck.co.uk/boat/sessa-marine-oyster-34-for-sale/811335', 'apolloduck');
  assert(idApollo === '811335', 'Apollo Duck external ID extraction');

  const idBoats = extractExternalId('https://www.boatsandoutboards.co.uk/boat/1997-beneteau-oceanis-461-10002369/', 'boatsandoutboards');
  assert(idBoats === '10002369', 'Boats and Outboards external ID extraction');

  // 3. Search Page Validation
  const validApollo = validateSearchPageUrl('https://www.apolloduck.co.uk/boats/power-boats');
  assert(validApollo.isValid && validApollo.marketplaceId === 'apolloduck', 'Valid Apollo Duck search page URL');

  const validBoats = validateSearchPageUrl('https://www.boatsandoutboards.co.uk/boats-for-sale/power-boats/');
  assert(validBoats.isValid && validBoats.marketplaceId === 'boatsandoutboards', 'Valid Boats and Outboards search page URL');

  const rejIndividualApollo = validateSearchPageUrl('https://www.apolloduck.co.uk/boat/sessa-marine-oyster-34-for-sale/811335');
  assert(!rejIndividualApollo.isValid && rejIndividualApollo.errorCode === 'INDIVIDUAL_LISTING_URL', 'Rejection of individual Apollo Duck listing URL');

  const rejIndividualBoats = validateSearchPageUrl('https://www.boatsandoutboards.co.uk/boat/1997-beneteau-oceanis-461-10002369/');
  assert(!rejIndividualBoats.isValid && rejIndividualBoats.errorCode === 'INDIVIDUAL_LISTING_URL', 'Rejection of individual Boats and Outboards listing URL');

  const rejUnsupported = validateSearchPageUrl('https://www.yachtworld.com/boats-for-sale/');
  assert(!rejUnsupported.isValid && rejUnsupported.errorCode === 'UNSUPPORTED_MARKETPLACE', 'Rejection of unsupported marketplace domain');

  // 4. Apollo Duck Discovery Adapter
  const sampleApolloHtml = `
    <a href="/boat/sessa-marine-oyster-34-for-sale/811335">
      <div class="_sbpanel">
        <div class="_sbimage"><img src="https://ics.apolloduck.com/image.jpg" /></div>
        <div class="_sbcaption">Sports Cruiser &pound;75,950</div>
      </div>
    </a>
    <a href="/boat/jonathan-wilson-57-traditional-for-sale/834664">
      <div class="_sbpanel">
        <div class="_sbimage"><img src="https://ics.apolloduck.com/image2.jpg" /></div>
        <div class="_sbcaption">Traditional Narrowboat &pound;85,000</div>
      </div>
    </a>
    <a href="/boats/sailing-boats">Sailing Category Link</a>
    <a href="/login">Login</a>
  `;

  const discoveredApollo = discoverApolloDuckListings(sampleApolloHtml, 'https://www.apolloduck.co.uk/boats/power-boats');
  assert(discoveredApollo.length === 2, 'Apollo Duck link discovery count');
  assert(discoveredApollo[0].externalId === '811335', 'First Apollo Duck listing ID');
  assert(discoveredApollo[0].priceText === '£75,950', 'Apollo Duck price decoding');
  assert(discoveredApollo[1].externalId === '834664', 'Second Apollo Duck listing ID');

  // 5. Boats and Outboards Discovery Adapter (Jina Reader Markdown)
  const sampleBoatsMarkdown = `
Title: Boats for sale | Boats and Outboards
Markdown Content:
* [Cruising yachts](https://www.boatsandoutboards.co.uk/boats-for-sale/type-sailing-boats/class-cruising-yachts/)
* [1997 Beneteau Oceanis 461 £ 85,253 MG Yachts | Salamina ![Image 23](https://images.boatsgroup.com/resize/1/23/69/image.jpg)](https://www.boatsandoutboards.co.uk/boat/1997-beneteau-oceanis-461-10002369/)
* [1991 Princess 35 Flybridge £ 49,950 Burton Waters | Ipswich ![Image 25](https://images.boatsgroup.com/resize/1/26/3/image2.jpg)](https://www.boatsandoutboards.co.uk/boat/1991-princess-35-flybridge-10142603/)
* [Dealer Search](https://www.boatsandoutboards.co.uk/dealer-search/)
  `;

  const discoveredBoats = discoverBoatsAndOutboardsListings(sampleBoatsMarkdown, 'https://www.boatsandoutboards.co.uk/boats-for-sale/');
  assert(discoveredBoats.length === 2, 'Boats and Outboards markdown discovery count');
  assert(discoveredBoats[0].externalId === '10002369', 'First Boats and Outboards ID');
  assert(discoveredBoats[0].title.includes('Beneteau'), 'Boats and Outboards title extraction');
  assert(discoveredBoats[0].priceText === '£ 85,253', 'Boats and Outboards price extraction');
  assert(discoveredBoats[0].locationText === 'Salamina', 'Boats and Outboards location extraction');

  console.log('\nALL SEARCH PAGE DISCOVERY UNIT TESTS PASSED SUCCESSFULLY!');
}

runTests().catch(err => {
  console.error('Test execution error:', err);
  process.exit(1);
});
