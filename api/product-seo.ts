import { IncomingMessage, ServerResponse } from 'http';
import fs from 'fs';
import path from 'path';
import * as admin from 'firebase-admin';

// Helper interface for our dynamic parsing
interface VercelRequest extends IncomingMessage {
  query?: Record<string, string | string[]>;
}

// Function to escape HTML to prevent XSS or breaking attributes
function escapeHtml(text: string): string {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Helpers to extract values from Firestore REST API JSON structures
function getStringValue(field: any): string {
  if (!field) return '';
  if (typeof field.stringValue === 'string') return field.stringValue;
  if (field.integerValue !== undefined) return String(field.integerValue);
  if (field.doubleValue !== undefined) return String(field.doubleValue);
  return '';
}

function getArrayValues(field: any): string[] {
  if (!field || !field.arrayValue || !Array.isArray(field.arrayValue.values)) {
    return [];
  }
  return field.arrayValue.values
    .map((val: any) => val.stringValue)
    .filter(Boolean);
}

export default async function handler(req: VercelRequest, res: ServerResponse) {
  const reqUrl = req.url || '';
  console.log(`[PRODUCT SEO] Requisição de SEO iniciada para a URL: ${reqUrl}`);

  // 1. Extração dos parâmetros de forma ultra-robusta (suporta query params e path chunks)
  let showcaseSlug = '';
  let productId = '';
  
  const decodedUrl = decodeURIComponent(reqUrl);
  // Remove possible duplicate slashes or query parameters parsing
  const urlObj = new URL(decodedUrl, 'http://localhost');
  const pathname = urlObj.pathname;
  
  // Extração via query params do Vercel router
  if (req.query && typeof req.query.showcaseSlug === 'string') {
    showcaseSlug = req.query.showcaseSlug;
  }
  if (req.query && typeof req.query.productId === 'string') {
    productId = req.query.productId;
  }

  // Fallback via path segments
  const pathSegments = pathname.split('/').filter(Boolean);
  // URL esperado: /empreendedores/:slug/produto/:productId
  if ((!showcaseSlug || !productId) && pathSegments.length >= 4) {
    showcaseSlug = pathSegments[1];
    productId = pathSegments[3];
  }

  console.log(`[PRODUCT SEO] Parâmetros extraídos -> showcaseSlug: "${showcaseSlug}", productId: "${productId}"`);

  // 2. Carregar o template de index.html base para injetar as tags ou para fallback rápido
  let htmlPath = path.join(process.cwd(), 'dist', 'index.html');
  let html = '';
  let templateLoadedFrom = '';
  
  try {
    if (fs.existsSync(htmlPath)) {
      html = fs.readFileSync(htmlPath, 'utf8');
      templateLoadedFrom = 'dist/index.html';
    } else {
      const rootHtmlPath = path.join(process.cwd(), 'index.html');
      if (fs.existsSync(rootHtmlPath)) {
        html = fs.readFileSync(rootHtmlPath, 'utf8');
        templateLoadedFrom = 'root/index.html';
      } else {
        html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /><title>ConnectBoat</title></head><body><div id="root"></div></body></html>`;
        templateLoadedFrom = 'inline-fallback';
      }
    }
    console.log(`[PRODUCT SEO] Template HTML carregado via: ${templateLoadedFrom} (${html.length} bytes)`);
  } catch (err) {
    console.error("[PRODUCT SEO] Erro ao ler index.html física:", err);
    html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /><title>ConnectBoat</title></head><body><div id="root"></div></body></html>`;
  }

  // Se parâmetros ausentes, devolvemos o HTML padrão imediatamente
  if (!showcaseSlug || !productId) {
    console.warn(`[PRODUCT SEO] Parâmetro em falta (showcaseSlug=${showcaseSlug}, productId=${productId}). Devolvendo HTML Padrão.`);
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end(html);
  }

  const projectId = 'navlink-489413';
  const firestoreDatabaseId = 'ai-studio-68f2b08f-f2a5-4a0e-9c12-0146a4e48db1';
  
  let showcaseName = 'Vitrine Digital';
  let productData: { name?: string; description?: string; price?: string; images?: string[]; active?: boolean } | null = null;

  // --- MÉTODO 1: Chamada via REST API pública do Firestore ---
  try {
    const runQueryUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${firestoreDatabaseId}/documents:runQuery`;
    console.log(`[PRODUCT SEO] Procurando perfil do vendedor pelo slug: "${showcaseSlug}"`);
    
    const queryBody = {
      structuredQuery: {
        from: [{ collectionId: 'sellerPublicProfiles' }],
        where: {
          fieldFilter: {
            field: { fieldPath: 'showcaseSlug' },
            op: 'EQUAL',
            value: { stringValue: showcaseSlug }
          }
        },
        limit: 1
      }
    };

    const queryRes = await fetch(runQueryUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(queryBody)
    });

    if (queryRes.ok) {
      const queryJson = await queryRes.json();
      if (Array.isArray(queryJson) && queryJson[0] && queryJson[0].document) {
        const doc = queryJson[0].document;
        const fields = doc.fields || {};
        showcaseName = getStringValue(fields.showcaseName) || 'Vitrine Digital';
        
        const docName = doc.name; // projects/[...]/databases/[...]/documents/sellerPublicProfiles/USER_ID
        const parts = docName.split('/');
        const sellerUserId = parts[parts.length - 1];
        
        console.log(`[PRODUCT SEO] Perfil encontrado! sellerUserId="${sellerUserId}", showcaseName="${showcaseName}"`);

        // Obter produto específico na subcoleção `/products`
        const productUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${firestoreDatabaseId}/documents/sellerPublicProfiles/${sellerUserId}/products/${productId}`;
        console.log(`[PRODUCT SEO] Procurando produto via REST API: ${productUrl}`);
        
        const prodRes = await fetch(productUrl);
        if (prodRes.ok) {
          const prodJson = await prodRes.json();
          if (prodJson && prodJson.fields) {
            const pFields = prodJson.fields;
            productData = {
              name: getStringValue(pFields.name),
              description: getStringValue(pFields.description),
              price: getStringValue(pFields.price),
              images: getArrayValues(pFields.images),
              active: pFields.active ? pFields.active.booleanValue !== false : true
            };
            console.log(`[PRODUCT SEO] Produto encontrado com sucesso! Nome: "${productData.name}"`);
          }
        }
      } else {
        console.log(`[PRODUCT SEO] Nenhum perfil correspondente ao slug "${showcaseSlug}" retornado da REST API.`);
      }
    } else {
      console.warn(`[PRODUCT SEO] Falha na REST API de consulta (Status: ${queryRes.status}).`);
    }
  } catch (err) {
    console.error("[PRODUCT SEO] Erro geral na chamada REST API do Firestore:", err);
  }

  // --- MÉTODO 2: Fallback via SDK Firebase Admin ---
  if (!productData) {
    try {
      console.log(`[PRODUCT SEO] Iniciando busca secundária por SDK Firebase Admin...`);
      
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

      // Query por slug da vitrine
      const profileSnap = await db.collection('sellerPublicProfiles')
        .where('showcaseSlug', '==', showcaseSlug)
        .limit(1)
        .get();

      if (!profileSnap.empty) {
        const profileDoc = profileSnap.docs[0];
        const pData = profileDoc.data();
        showcaseName = pData?.showcaseName || 'Vitrine Digital';
        const sellerUserId = profileDoc.id;

        // Buscar do produto correspondente
        const prodSnap = await db.collection('sellerPublicProfiles')
          .doc(sellerUserId)
          .collection('products')
          .doc(productId)
          .get();

        if (prodSnap.exists) {
          const prData = prodSnap.data();
          if (prData) {
            productData = {
              name: prData.name,
              description: prData.description,
              price: prData.price ? String(prData.price) : '',
              images: prData.images || [],
              active: prData.active !== false
            };
            console.log(`[PRODUCT SEO] Produto carregado de forma bem-sucedida pelo SDK Firebase Admin.`);
          }
        }
      }
    } catch (err) {
      console.error("[PRODUCT SEO] Erro crítico no fallback do SDK Firebase Admin:", err);
    }
  }

  // Se produto não existiu ou inativo, devolvemos o HTML padrão de imediato
  if (!productData || productData.active === false) {
    console.warn(`[PRODUCT SEO] Produto não localizado ou inativo. Servindo HTML de fallback diretamente.`);
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end(html);
  }

  // 3. Montar as Metatags Dinâmicas exigidas
  const rawTitle = productData.name || 'Product';
  const priceSuffix = productData.price ? ` - £${productData.price}` : '';
  const title = escapeHtml(`${rawTitle}${priceSuffix} | Digital Showcase ${showcaseName} on ConnectBoat`);
  
  const description = escapeHtml(
    (productData.description || 'Check out this product on ConnectBoat!').substring(0, 160) + 
    ((productData.description || '').length > 160 ? '...' : '')
  );

  let ogImage = '';
  const fallbackUrl = 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&q=80&w=800';

  // Garantir imagem pública transparente e sem blobs/base64
  if (productData.images && Array.isArray(productData.images)) {
    for (const img of productData.images) {
      if (img && typeof img === 'string' && img.trim().startsWith('https://') && !img.includes(';base64,')) {
        ogImage = img.trim();
        break;
      }
    }
  }

  if (!ogImage) {
    ogImage = fallbackUrl;
  }

  const finalProductUrl = `https://www.connectboat.co.uk/empreendedores/${showcaseSlug}/produto/${productId}`;

  console.log(`[PRODUCT SEO] Injetando metatags -> Título: "${title}", Imagem: "${ogImage}"`);

  // Metatags em conformidade total com os crawlers (WhatsApp, Facebook, Discord, Slack, Apple, etc.)
  const metaTags = `
  <title>${title}</title>
  <meta name="description" content="${description}" />
  <meta property="og:url" content="${finalProductUrl}" />
  <meta property="og:title" content="${title}" />
  <meta property="og:description" content="${description}" />
  <meta property="og:image" content="${escapeHtml(ogImage)}" />
  <meta property="og:type" content="product" />
  <meta property="og:site_name" content="ConnectBoat" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${title}" />
  <meta name="twitter:description" content="${description}" />
  <meta name="twitter:image" content="${escapeHtml(ogImage)}" />
`;

  // Remover tags antigas no HTML original (como títulos duplicados ou tags default)
  html = html.replace(/<title>[^]*?<\/title>/gi, '');
  html = html.replace(/<meta property="og:[^]*?\/>/gi, '');
  html = html.replace(/<meta name="twitter:[^]*?\/>/gi, '');

  // Inserir as novas tags otimizadas imediatamente abaixo da abertura da tag <head>
  html = html.replace(/<head>/i, `<head>${metaTags}`);

  console.log(`[PRODUCT SEO] Metatags injetadas com sucesso para o produto: "${rawTitle}"`);

  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  return res.end(html);
}
