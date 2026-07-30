async function parseApolloDetails() {
  const url = 'https://www.apolloduck.com/boat/tornado-5-5m-for-sale/760983';
  console.log('Fetching:', url);
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
    }
  });
  const html = await res.text();

  console.log('--- Checking Meta tags in Apollo Duck ---');
  const metaRegex = /<meta\s+[^>]*>/gi;
  let match;
  while ((match = metaRegex.exec(html)) !== null) {
    const tag = match[0];
    if (tag.includes('og:') || tag.includes('price') || tag.includes('description') || tag.includes('title')) {
      console.log('Meta tag:', tag);
    }
  }

  console.log('--- Searching for price & location elements ---');
  // Dump tables or divs or spans
  const tagMatches = [...html.matchAll(/<([a-z1-6]+)([^>]*)>([\s\S]*?)<\/\1>/gi)];
  console.log('Total tags matched:', tagMatches.length);

  for (const tm of tagMatches) {
    const tagName = tm[1];
    const attrs = tm[2];
    const content = tm[3].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

    if (content) {
      if (
        content.includes('£') || content.includes('€') || content.includes('US$') || 
        content.toLowerCase().includes('lying') || content.toLowerCase().includes('location') ||
        content.toLowerCase().includes('advertiser') || content.toLowerCase().includes('built')
      ) {
        if (content.length < 250) {
          console.log(`<${tagName} ${attrs}> => "${content}"`);
        }
      }
    }
  }
}

parseApolloDetails();
