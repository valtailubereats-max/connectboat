async function testApolloRaw() {
  const url = 'https://www.apolloduck.com/boat/tornado-5-5m-for-sale/760983';
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
    }
  });
  const html = await res.text();
  console.log('HTML Length:', html.length);

  // Search for keywords in raw HTML and print 300 chars context
  const keywords = ['price', 'lying', 'location', 'advertiser', 'length', 'built', 'year', '£', '€', 'gbp', 'eur', 'usd'];

  for (const kw of keywords) {
    console.log(`\n=================== KEYWORD: "${kw}" ===================`);
    let pos = 0;
    let count = 0;
    while ((pos = html.toLowerCase().indexOf(kw.toLowerCase(), pos)) !== -1) {
      count++;
      if (count <= 5) { // Print first 5 matches per keyword
        const start = Math.max(0, pos - 100);
        const end = Math.min(html.length, pos + 200);
        const snippet = html.slice(start, end).replace(/\s+/g, ' ');
        console.log(`Match ${count} at ${pos}: ${snippet}`);
      }
      pos += kw.length;
    }
    console.log(`Total occurrences of "${kw}": ${count}`);
  }
}

testApolloRaw();
