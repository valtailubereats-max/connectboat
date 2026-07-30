import {
  getSupportedMarketplace,
  isValidMarketplaceUrl,
  getSourceSiteFromUrl,
  getSupportedMarketplacesMessage
} from './marketplaces';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ FAIL: ${message}`);
    process.exit(1);
  } else {
    console.log(`✅ PASS: ${message}`);
  }
}

console.log('Running Marketplace Validation Tests...');

// 1. Valid supported domains
const mp1 = getSupportedMarketplace('https://boatsandoutboards.co.uk/boat/123');
assert(mp1?.id === 'boatsandoutboards', 'boatsandoutboards.co.uk identified');

const mp2 = getSupportedMarketplace('https://apolloduck.com/boat/456');
assert(mp2?.id === 'apolloduck', 'apolloduck.com identified');

const mp3 = getSupportedMarketplace('https://olx.pt/d/anuncio/123');
assert(mp3?.id === 'olx', 'olx.pt identified');

const mp4 = getSupportedMarketplace('https://gumtree.com/p/boats/123');
assert(mp4?.id === 'gumtree', 'gumtree.com identified');

// 2. www variants
const mpWww = getSupportedMarketplace('https://www.boatsandoutboards.co.uk/boat/123');
assert(mpWww?.id === 'boatsandoutboards', 'www.boatsandoutboards.co.uk identified');

// 3. Valid subdomains
const mpSub = getSupportedMarketplace('https://uk.boats.com/boats-for-sale/123');
assert(mpSub?.id === 'boats', 'uk.boats.com identified as boats.com');

// 4. Uppercase hostnames
const mpUpper = getSupportedMarketplace('HTTPS://WWW.YACHTWORLD.COM/yacht/123');
assert(mpUpper?.id === 'yachtworld', 'Uppercase WWW.YACHTWORLD.COM identified');

// 5. Deceptive unsupported domains
assert(getSupportedMarketplace('https://boatsandoutboards.co.uk.fake-site.com/test') === null, 'Rejects boatsandoutboards.co.uk.fake-site.com');
assert(getSupportedMarketplace('https://fakeboatsandoutboards.co.uk/test') === null, 'Rejects fakeboatsandoutboards.co.uk');
assert(getSupportedMarketplace('https://apolloduck.com.example.org') === null, 'Rejects apolloduck.com.example.org');

// 6. Invalid protocols
assert(getSupportedMarketplace('javascript:alert(1)') === null, 'Rejects javascript: protocol');
assert(getSupportedMarketplace('file:///etc/passwd') === null, 'Rejects file: protocol');
assert(getSupportedMarketplace('data:text/html,hello') === null, 'Rejects data: protocol');

// 7. Malformed URLs
assert(getSupportedMarketplace('not-a-url') === null, 'Rejects malformed URL string');
assert(getSupportedMarketplace('') === null, 'Rejects empty URL');

// 8. Marketplace name detection
assert(getSourceSiteFromUrl('https://www.rightboat.com/boats-for-sale') === 'Rightboat', 'Detects Rightboat name');
assert(getSourceSiteFromUrl('https://theyachtmarket.com/boats/123') === 'TheYachtMarket', 'Detects TheYachtMarket name');
assert(getSourceSiteFromUrl('https://boatshop24.com/boat/123') === 'Boatshop24', 'Detects Boatshop24 name');
assert(getSourceSiteFromUrl('https://boat24.com/boat/123') === 'Boat24', 'Detects Boat24 name');

console.log('All Marketplace Tests Passed Successfully!');
