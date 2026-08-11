import { IncomingMessage, ServerResponse } from 'http';
import * as admin from 'firebase-admin';

// Helper interface for our dynamic parsing
interface VercelRequest extends IncomingMessage {
  query?: Record<string, string | string[]>;
}

function escapeXml(text: string): string {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function generateSlug(title: string): string {
  if (!title) return '';
  return title
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/[-\s]+/g, '-');
}

export default async function handler(req: VercelRequest, res: ServerResponse) {
  console.log(`[DYNAMIC SITEMAP] Responding to sitemap.xml request.`);

  const projectId = 'navlink-489413';
  const firestoreDatabaseId = 'ai-studio-boatmarket-b1c69205-2a63-42a8-922c-14b64e4cb382';
  
  interface SitemapItem {
    loc: string;
    lastmod: string;
    changefreq: string;
    priority: string;
  }

  // Get current date formatted as YYYY-MM-DD
  const currentDateISO = new Date().toISOString();
  const currentDateStr = currentDateISO.split('T')[0];

  // Base static items
  const items: SitemapItem[] = [
    { loc: 'https://connectboat.co.uk/', lastmod: currentDateStr, changefreq: 'daily', priority: '1.0' },
    { loc: 'https://connectboat.co.uk/faq', lastmod: currentDateStr, changefreq: 'monthly', priority: '0.8' },
    { loc: 'https://connectboat.co.uk/pricing', lastmod: currentDateStr, changefreq: 'monthly', priority: '0.8' },
    { loc: 'https://connectboat.co.uk/suggestions', lastmod: currentDateStr, changefreq: 'monthly', priority: '0.6' },
    { loc: 'https://connectboat.co.uk/terms', lastmod: currentDateStr, changefreq: 'monthly', priority: '0.5' },
    { loc: 'https://connectboat.co.uk/privacy', lastmod: currentDateStr, changefreq: 'monthly', priority: '0.5' },
    { loc: 'https://connectboat.co.uk/cookie-policy', lastmod: currentDateStr, changefreq: 'monthly', priority: '0.5' },
    { loc: 'https://connectboat.co.uk/photos', lastmod: currentDateStr, changefreq: 'weekly', priority: '0.7' },
    { loc: 'https://connectboat.co.uk/links', lastmod: currentDateStr, changefreq: 'monthly', priority: '0.4' },
    { loc: 'https://connectboat.co.uk/report', lastmod: currentDateStr, changefreq: 'monthly', priority: '0.3' }
  ];

  let ads: { id: string; title: string; lastmod: string }[] = [];

  // --- METHOD 1: Fetch via public Firestore runQuery REST API (POST) ---
  try {
    const firestoreRestUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${firestoreDatabaseId}/documents:runQuery`;
    console.log(`[DYNAMIC SITEMAP] Fetching approved ads via runQuery (POST) REST API: ${firestoreRestUrl}`);

    const runQueryBody = {
      structuredQuery: {
        from: [
          {
            collectionId: 'ads',
            allDescendants: false
          }
        ],
        where: {
          fieldFilter: {
            field: {
              fieldPath: 'status'
            },
            op: 'EQUAL',
            value: {
              stringValue: 'approved'
            }
          }
        },
        limit: 1000
      }
    };
    
    const restRes = await fetch(firestoreRestUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(runQueryBody)
    });

    if (restRes.ok) {
      const data = await restRes.json();
      console.log(`[DYNAMIC SITEMAP] REST API response is array of size: ${Array.isArray(data) ? data.length : typeof data}`);
      
      if (Array.isArray(data)) {
        for (const result of data) {
          if (result && result.document) {
            const doc = result.document;
            const name = doc.name || '';
            const fields = doc.fields || {};
            const adId = name.split('/').pop() || '';
            const title = fields.title?.stringValue || '';
            
            // Get lastmod date from createdAt or updatedAt timestamp
            let adDate = currentDateStr;
            const timestampValue = fields.createdAt?.timestampValue || fields.updatedAt?.timestampValue;
            if (timestampValue && typeof timestampValue === 'string') {
              adDate = timestampValue.split('T')[0];
            }
            
            if (adId && title) {
              ads.push({ id: adId, title, lastmod: adDate });
            }
          }
        }
        console.log(`[DYNAMIC SITEMAP] Successfully parsed ${ads.length} approved ads from Firestore REST API.`);
      }
    } else {
      const errorText = await restRes.text().catch(() => '');
      console.warn(`[DYNAMIC SITEMAP] REST API returned status code ${restRes.status}, error details: ${errorText}. Fallback to Firebase Admin SDK.`);
    }
  } catch (err) {
    console.error("[DYNAMIC SITEMAP] Error fetching from REST API:", err);
  }

  // --- METHOD 2 (FALLBACK): Fetch via Firebase Admin SDK ---
  if (ads.length === 0) {
    try {
      console.log(`[DYNAMIC SITEMAP] Fallback execution with SDK Firebase Admin...`);
      
      if (!admin.apps.length) {
        const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT;
        if (serviceAccountJson) {
          try {
            const serviceAccount = JSON.parse(serviceAccountJson);
            admin.initializeApp({
              credential: admin.credential.cert(serviceAccount),
              projectId: projectId,
            });
          } catch (e) {
            admin.initializeApp({ projectId: projectId });
          }
        } else {
          admin.initializeApp({ projectId: projectId });
        }
      }

      const db = admin.firestore();
      if (firestoreDatabaseId) {
        db.settings({ databaseId: firestoreDatabaseId });
      }

      const adsSnap = await db.collection('ads').where('status', '==', 'approved').get();
      adsSnap.forEach(adDoc => {
        const adData = adDoc.data();
        if (adData) {
          let adDate = currentDateStr;
          if (adData.createdAt) {
            if (adData.createdAt.toDate && typeof adData.createdAt.toDate === 'function') {
              adDate = adData.createdAt.toDate().toISOString().split('T')[0];
            } else if (typeof adData.createdAt === 'string') {
              adDate = adData.createdAt.split('T')[0];
            } else if (adData.createdAt.seconds) {
              adDate = new Date(adData.createdAt.seconds * 1000).toISOString().split('T')[0];
            }
          }
          ads.push({
            id: adDoc.id,
            title: adData.title || '',
            lastmod: adDate
          });
        }
      });
      console.log(`[DYNAMIC SITEMAP] Successfully parsed ${ads.length} approved ads via Firebase Admin.`);
    } catch (err) {
      console.error("[DYNAMIC SITEMAP] Fallback Firebase Admin failed:", err);
    }
  }

  // Process and append ads to items list
  let adsCount = 0;
  for (const ad of ads) {
    const slug = generateSlug(ad.title);
    const loc = `https://connectboat.co.uk/anuncio/${slug ? `${slug}-` : ''}${ad.id}`;
    items.push({
      loc,
      lastmod: ad.lastmod,
      changefreq: 'weekly',
      priority: '0.7'
    });
    adsCount++;
  }
  console.log(`[DYNAMIC SITEMAP] Added ${adsCount} ad URLs to sitemap.`);

  // Construct XML response
  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';
  
  for (const item of items) {
    xml += '  <url>\n';
    xml += `    <loc>${escapeXml(item.loc)}</loc>\n`;
    xml += `    <lastmod>${escapeXml(item.lastmod)}</lastmod>\n`;
    xml += `    <changefreq>${escapeXml(item.changefreq)}</changefreq>\n`;
    xml += `    <priority>${escapeXml(item.priority)}</priority>\n`;
    xml += '  </url>\n';
  }
  
  xml += '</urlset>\n';

  res.writeHead(200, {
    'Content-Type': 'application/xml; charset=utf-8',
    'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=600'
  });
  return res.end(xml);
}
