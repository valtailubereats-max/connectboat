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
  console.log(`[SEO SERVERLESS] Requisição recebida com URL: ${reqUrl}`);

  // 1. Extração do parâmetro ID de forma ultra-robusta (suporta slugs e IDs simples)
  let idParam = '';
  const decodedUrl = decodeURIComponent(reqUrl);
  const urlObj = new URL(decodedUrl, 'http://localhost');
  const pathname = urlObj.pathname;
  
  if (req.query && typeof req.query.id === 'string') {
    idParam = req.query.id;
  } else if (req.query && typeof req.query.slugAndId === 'string') {
    idParam = req.query.slugAndId;
  } else {
    const pathSegments = pathname.split('/').filter(Boolean);
    if (pathSegments.length >= 2) {
      idParam = pathSegments[1];
    }
  }

  // O ID exato do Firestore é o último fragmento após o caractere '-'
  const segments = idParam.split('-');
  const adId = segments[segments.length - 1];

  console.log(`[SEO SERVERLESS] idParam extraído: "${idParam}". ID do Anúncio final: "${adId}"`);

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
    console.log(`[SEO SERVERLESS] Template HTML carregado via: ${templateLoadedFrom} (tamanho: ${html.length} bytes)`);
  } catch (err) {
    console.error("[SEO SERVERLESS] Erro ao ler index.html física:", err);
    html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /><title>ConnectBoat</title></head><body><div id="root"></div></body></html>`;
  }

  // Se o ID do anúncio não foi extraído corretamente, devolvemos o HTML padrão de imediato
  if (!adId) {
    console.warn(`[SEO SERVERLESS] ID de anúncio inválido ou ausente. Devolvendo HTML de fallback imediatamente.`);
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end(html);
  }

  const projectId = 'navlink-489413';
  const firestoreDatabaseId = 'ai-studio-68f2b08f-f2a5-4a0e-9c12-0146a4e48db1';
  let adDataEx: { title?: string; description?: string; images?: string[]; imageUrl?: string; price?: number | string; city?: string; country?: string } | null = null;

  // --- MÉTODO 1: Chamada via REST API pública do Firestore ---
  // Vantagem extrema: Não precisa de credenciais de conta de serviço (FIREBASE_SERVICE_ACCOUNT) nas variáveis da Vercel
  try {
    const firestoreRestUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${firestoreDatabaseId}/documents/ads/${adId}`;
    console.log(`[SEO SERVERLESS] Tentando obter dados via Firestore REST API: ${firestoreRestUrl}`);
    
    const restRes = await fetch(firestoreRestUrl);
    console.log(`[SEO SERVERLESS] Resposta da REST API status: ${restRes.status}`);
    
    if (restRes.ok) {
      const docJson = await restRes.json();
      if (docJson && docJson.fields) {
        const fields = docJson.fields;
        
        adDataEx = {
          title: getStringValue(fields.title),
          description: getStringValue(fields.description),
          imageUrl: getStringValue(fields.imageUrl),
          price: getStringValue(fields.price),
          city: getStringValue(fields.city),
          country: getStringValue(fields.country),
          images: getArrayValues(fields.images)
        };
        console.log(`[SEO SERVERLESS] Dados extraídos com sucesso do Firestore REST API para o anúncio "${adDataEx.title}"`);
      }
    } else {
      console.warn(`[SEO SERVERLESS] Firestore REST API retornou erro ${restRes.status}. Tentando fallback de SDK.`);
    }
  } catch (err) {
    console.error("[SEO SERVERLESS] Erro na requisição REST API do Firestore:", err);
  }

  // --- MÉTODO 2 (FALLBACK): Busca via SDK Firebase Admin ---
  if (!adDataEx) {
    try {
      console.log(`[SEO SERVERLESS] Iniciando fallback com SDK Firebase Admin...`);
      
      if (!admin.apps.length) {
        const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT;
        if (serviceAccountJson) {
          try {
            const serviceAccount = JSON.parse(serviceAccountJson);
            admin.initializeApp({
              credential: admin.credential.cert(serviceAccount),
              projectId: projectId,
            });
            console.log(`[SEO SERVERLESS] Firebase Admin inicializado com conta de serviço.`);
          } catch (e) {
            console.error("[SEO SERVERLESS] Falha ao analisar service account JSON do ambiente, usando inicialização padrão.");
            admin.initializeApp({ projectId: projectId });
          }
        } else {
          admin.initializeApp({ projectId: projectId });
          console.log(`[SEO SERVERLESS] Firebase Admin inicializado de forma simplificada.`);
        }
      }

      const db = admin.firestore();
      if (firestoreDatabaseId) {
        db.settings({ databaseId: firestoreDatabaseId });
      }

      const adDocRef = db.collection('ads').doc(adId);
      const adSnap = await adDocRef.get();

      if (adSnap.exists) {
        const adData = adSnap.data();
        if (adData) {
          adDataEx = {
            title: adData.title,
            description: adData.description,
            imageUrl: adData.imageUrl,
            price: adData.price,
            city: adData.city,
            country: adData.country,
            images: adData.images
          };
          console.log(`[SEO SERVERLESS] Dados obtidos com sucesso através do fallback do Firebase Admin SDK.`);
        }
      } else {
        console.warn(`[SEO SERVERLESS] O anúncio não existe no Firestore clássico através da SDK de admin.`);
      }
    } catch (err) {
      console.error("[SEO SERVERLESS] Erro crítico no fallback da SDK Firebase Admin:", err);
    }
  }

  // Se nenhum dos métodos conseguiu recuperar os dados do anúncio, retornamos o html estático
  if (!adDataEx) {
    console.warn(`[SEO SERVERLESS] Não foi possível ler o anúncio ${adId} por nenhum método. Entregando HTML padrão.`);
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end(html);
  }

  // 5. Preparar as variáveis e os metadados dinâmicos para a injeção
  const rawTitle = adDataEx.title || 'Listing';
  const countryVal = adDataEx.country || 'United Kingdom';
  const rawLocation = adDataEx.city ? ` - ${adDataEx.city}, ${countryVal}` : '';
  const title = escapeHtml(`${rawTitle}${rawLocation} | ConnectBoat`);
  
  const description = escapeHtml(
    (adDataEx.description || 'Check out this boat & marine listing on ConnectBoat!').substring(0, 160) + 
    ((adDataEx.description || '').length > 160 ? '...' : '')
  );
  
  let adImage = '';
  const fallbackUrl = 'https://connectboat.co.uk/api/og-image';

  // Helper to validate and return string only if it is a public URL and not base64
  const isValidUrl = (urlStr: any): boolean => {
    if (!urlStr || typeof urlStr !== 'string') return false;
    const s = urlStr.trim();
    return (s.startsWith('http://') || s.startsWith('https://')) && !s.startsWith('data:') && !s.includes(';base64,');
  };

  // 1. Procurar no array de imagens pelo primeiro link público válido (não-Base64)
  if (adDataEx.images && Array.isArray(adDataEx.images)) {
    for (const img of adDataEx.images) {
      if (isValidUrl(img)) {
        adImage = img.trim();
        break;
      }
    }
  }

  // 2. Procurar na propriedade imageUrl individual caso o array não tenha trazido nenhum válido
  if (!adImage && isValidUrl(adDataEx.imageUrl)) {
    adImage = adDataEx.imageUrl!.trim();
  }

  // 3. Fallback definitivo se não houver nenhuma imagem pública válida do anúncio
  if (!adImage) {
    adImage = fallbackUrl;
    console.log(`[SEO SERVERLESS] Nenhuma imagem pública válida encontrada (provável Base64 ou nula). Usando imagem padrão: ${adImage}`);
  }

  const canonicalHost = 'connectboat.co.uk';
  const adUrl = `https://${canonicalHost}${pathname}`;

  console.log(`[SEO SERVERLESS] Preparando injeção. Título: "${title}", Imagem: "${adImage}", URL: "${adUrl}"`);

  // 6. Gerar e injetar os blocos de tags dinâmicas no Header da página
  const metaTags = `
  <title>${title}</title>
  <meta name="description" content="${description}" />
  <link rel="canonical" href="${adUrl}" />
  <meta property="og:url" content="${adUrl}" />
  <meta property="og:title" content="${title}" />
  <meta property="og:description" content="${description}" />
  <meta property="og:image" content="${escapeHtml(adImage)}" />
  <meta property="og:type" content="website" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${title}" />
  <meta name="twitter:description" content="${description}" />
  <meta name="twitter:image" content="${escapeHtml(adImage)}" />
`;

  // Remover tags antigas no HTML original (como títulos duplicados ou tags default de templates) para evitar poluição visual e meta conflitos
  html = html.replace(/<title>[^]*?<\/title>/gi, '');
  html = html.replace(/<meta property="og:[^]*?\/>/gi, '');
  html = html.replace(/<meta name="twitter:[^]*?\/>/gi, '');

  // Inserir as novas tags otimizadas imediatamente abaixo da abertura da tag <head>
  html = html.replace(/<head>/i, `<head>${metaTags}`);

  console.log(`[SEO SERVERLESS] Tags de Open Graph / Twitter Cards injetadas com sucesso!`);

  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  return res.end(html);
}
