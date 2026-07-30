import discoverListingsHandler from '../api/discover-listings.js';

class MockResponse {
  statusCode: number = 200;
  headers: Record<string, string> = {};
  body: any = null;

  setHeader(name: string, value: string) {
    this.headers[name] = value;
  }

  status(code: number) {
    this.statusCode = code;
    return this;
  }

  json(data: any) {
    this.body = data;
    return this;
  }

  end() {
    return this;
  }
}

async function runRealAcceptanceTests() {
  console.log('=========================================================');
  console.log('REAL ACCEPTANCE TEST — APOLLO DUCK');
  console.log('=========================================================');

  const apolloUrl = 'https://www.apolloduck.co.uk/boats/power-boats';
  const apolloReq = {
    method: 'POST',
    body: JSON.stringify({
      pageUrl: apolloUrl,
      userRole: 'admin'
    })
  } as any;

  const apolloRes = new MockResponse();
  await discoverListingsHandler(apolloReq, apolloRes as any);

  console.log('Apollo Duck HTTP Status:', apolloRes.statusCode);
  const aData = apolloRes.body;
  console.log('Exact results-page URL tested:', aData.pageUrl);
  console.log('Direct HTTP status:', aData._diagnostics?.directStatus);
  console.log('Fallback used:', aData._diagnostics?.fallbackUsed);
  console.log('Fetch source:', aData._diagnostics?.fetchSource);
  console.log('Response length:', aData._diagnostics?.htmlLength);
  console.log('Total candidate links:', aData.totalCandidates);
  console.log('Valid unique advertisement links:', aData.totalFound);
  console.log('Duplicate links removed:', aData.duplicatesRemoved);
  console.log('Already imported count:', aData.alreadyImportedCount);
  console.log('First 5 normalized listing URLs:');
  const first5Apollo = aData.listings.slice(0, 5);
  first5Apollo.forEach((l: any, i: number) => {
    console.log(`  ${i + 1}. ${l.normalizedSourceUrl}`);
    console.log(`     Title: ${l.title || 'N/A'}`);
    console.log(`     Thumbnail: ${l.image ? 'Available (' + l.image.slice(0, 50) + '...)' : 'None'}`);
    console.log(`     Price: ${l.priceText || 'N/A'}`);
    console.log(`     Location: ${l.locationText || 'N/A'}`);
  });

  console.log('\n=========================================================');
  console.log('REAL ACCEPTANCE TEST — BOATS AND OUTBOARDS');
  console.log('=========================================================');

  const boatsUrl = 'https://www.boatsandoutboards.co.uk/boats-for-sale/';
  const boatsReq = {
    method: 'POST',
    body: JSON.stringify({
      pageUrl: boatsUrl,
      userRole: 'admin'
    })
  } as any;

  const boatsRes = new MockResponse();
  await discoverListingsHandler(boatsReq, boatsRes as any);

  console.log('Boats & Outboards HTTP Status:', boatsRes.statusCode);
  const bData = boatsRes.body;
  if (boatsRes.statusCode !== 200) {
    console.error('Boats & Outboards Error Body:', bData);
    return;
  }
  console.log('Exact results-page URL tested:', bData.pageUrl);
  console.log('Direct HTTP status:', bData._diagnostics?.directStatus);
  console.log('Fallback used (Jina Reader):', bData._diagnostics?.fallbackUsed);
  console.log('Fetch source:', bData._diagnostics?.fetchSource);
  console.log('Response length:', bData._diagnostics?.htmlLength);
  console.log('Total candidate links:', bData.totalCandidates);
  console.log('Valid unique advertisement links:', bData.totalFound);
  console.log('Duplicate links removed:', bData.duplicatesRemoved);
  console.log('Already imported count:', bData.alreadyImportedCount);
  console.log('First 5 normalized listing URLs:');
  const first5Boats = bData.listings.slice(0, 5);
  first5Boats.forEach((l: any, i: number) => {
    console.log(`  ${i + 1}. ${l.normalizedSourceUrl}`);
    console.log(`     Title: ${l.title || 'N/A'}`);
    console.log(`     Thumbnail: ${l.image ? 'Available (' + l.image.slice(0, 50) + '...)' : 'None'}`);
    console.log(`     Price: ${l.priceText || 'N/A'}`);
    console.log(`     Location: ${l.locationText || 'N/A'}`);
  });
}

runRealAcceptanceTests().catch(err => {
  console.error('Real acceptance test error:', err);
  process.exit(1);
});
