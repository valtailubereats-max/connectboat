import type { Request, Response } from 'express';

// Decodificador de HTML Entities
const decodeHtmlEntities = (str: string): string => {
  if (!str) return '';
  let temp = str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(parseInt(dec, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
  
  try {
    temp = temp.replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
  } catch (e) {
    // ignore
  }
  return temp;
};

// Limpador do título
const cleanTitle = (title: string): string => {
  if (!title) return '';
  let temp = decodeHtmlEntities(title)
    .replace(/\s*-\s*à venda\s*-\s*.*$/gi, '')
    .replace(/\s*-\s*OLX\s*Portugal.*$/gi, '')
    .replace(/\s*-\s*OLX.*$/gi, '')
    .replace(/\s*[|]\s*Gumtree.*$/gi, '')
    .replace(/\s*-\s*Gumtree.*$/gi, '')
    .replace(/\s*in\s+[^|]+[|]\s*Gumtree.*$/gi, '')
    .replace(/\|.*$/gi, '')
    .trim();

  // Remove emojis raros para manter o design clean
  temp = temp.replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '');
  
  // Substitui espaços duplicados
  temp = temp.replace(/\s+/g, ' ');

  return temp.trim();
};

// Limpador da descrição
const cleanDescription = (desc: string): string => {
  if (!desc) return '';
  let temp = decodeHtmlEntities(desc);
  
  // Remove tags HTML se houver
  temp = temp.replace(/<[^>]*>/g, '');

  // Remove caracteres de controle mantendo normais o carriage return e quebras de linha
  temp = temp.replace(/[\x00-\x09\x0B-\x0C\x0E-\x1F\x7F-\x9F]/g, '');

  temp = temp.replace(/\r/g, '');
  temp = temp.replace(/\n{3,}/g, '\n\n'); // Permite no máximo 2 novas linhas consecutivas
  temp = temp.split('\n').map(line => line.trim()).join('\n');
  temp = temp.split('\n').map(line => line.replace(/[ \t]{2,}/g, ' ')).join('\n'); // Evita visual spacing slop

  return temp.trim();
};

// Parseador de preço
const parsePrice = (priceStr: string | number | undefined | null): number => {
  if (priceStr === undefined || priceStr === null) return 0;
  if (typeof priceStr === 'number') return priceStr;
  
  let str = String(priceStr).trim();
  if (!str) return 0;

  // Remove símbolos monetários e espaços
  str = str.replace(/[€$£\s]/g, '');

  // Analisa o estilo decimal
  const lastComma = str.lastIndexOf(',');
  const lastDot = str.lastIndexOf('.');
  
  if (lastComma > lastDot && (lastComma === str.length - 3 || lastComma === str.length - 2)) {
    // Vírgula decimal europeia: 1.250,50 ou 1250,5
    str = str.replace(/\./g, '').replace(',', '.');
  } else if (lastDot > lastComma && (lastDot === str.length - 3 || lastDot === str.length - 2)) {
    // Ponto decimal americano: 1,250.50
    str = str.replace(/,/g, '');
  } else {
    // Sem fração decimal explícita
    str = str.replace(/[.,]/g, '');
  }

  // Captura o primeiro dígito correspondente
  const match = str.match(/\d+(?:\.\d+)?/);
  if (match) {
    const parsed = parseFloat(match[0]);
    return isNaN(parsed) ? 0 : parsed;
  }
  return 0;
};

// Extrair tag Meta de HTML
const extractMetaContent = (html: string, nameOrProperty: string): string | null => {
  const regexes = [
    new RegExp(`<meta[^>]+(?:property|name)=["']${nameOrProperty}["'][^>]+content=["']([^"']+)["']`, 'i'),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${nameOrProperty}["']`, 'i')
  ];
  for (const regex of regexes) {
    const match = html.match(regex);
    if (match) {
      return decodeHtmlEntities(match[1]);
    }
  }
  return null;
};

// Extrair JsonLd de HTML
const extractJsonLd = (html: string): any[] => {
  const results: any[] = [];
  const regex = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match;
  while ((match = regex.exec(html)) !== null) {
    try {
      const parsed = JSON.parse(match[1].trim());
      if (parsed) {
        results.push(parsed);
      }
    } catch (e) {
      // ignore
    }
  }
  return results;
};

// Extrair dados do Produto do JsonLd listado
const extractFromJsonLdList = (jsonLdList: any[]): any => {
  for (const obj of jsonLdList) {
    if (!obj) continue;
    const searchProduct = (item: any): any => {
      if (!item) return null;
      if (typeof item !== 'object') return null;
      if (Array.isArray(item)) {
        for (const child of item) {
          const res = searchProduct(child);
          if (res) return res;
        }
      } else {
        const typeStr = String(item['@type'] || '').toLowerCase();
        if (typeStr === 'product' || typeStr === 'productmodel') {
          return item;
        }
        if (item['@graph']) {
          const res = searchProduct(item['@graph']);
          if (res) return res;
        }
        for (const k of Object.keys(item)) {
          const res = searchProduct(item[k]);
          if (res) return res;
        }
      }
      return null;
    };
    const productNode = searchProduct(obj);
    if (productNode) {
      return productNode;
    }
  }
  return null;
};

// Encontrar localidade em JsonLd
const findLocationInJsonLd = (obj: any): string | null => {
  if (!obj) return null;
  if (typeof obj !== 'object') return null;
  if (Array.isArray(obj)) {
    for (const item of obj) {
      const loc = findLocationInJsonLd(item);
      if (loc) return loc;
    }
  } else {
    if (obj.addressLocality) {
      return String(obj.addressLocality);
    }
    if (obj.addressRegion) {
      return String(obj.addressRegion);
    }
    for (const k of Object.keys(obj)) {
      const loc = findLocationInJsonLd(obj[k]);
      if (loc) return loc;
    }
  }
  return null;
};

// Função robusta e resiliente para descarregar o HTML da página do anúncio
async function fetchAdHtml(url: string): Promise<{ html: string; source: string }> {
  console.log('[Import Pipeline] Stage: Fetching HTML from URL:', url);

  const headersList = [
    {
      'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4.1 Mobile/15E148 Safari/604.1',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-GB,en;q=0.9,pt-PT,pt;q=0.8',
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache',
      'Upgrade-Insecure-Requests': '1'
    },
    {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
      'Accept-Language': 'pt-PT,pt;q=0.9,en-GB;q=0.8,en;q=0.7',
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache'
    }
  ];

  // Tentativa 1: Fetch direto com Headers alternados
  for (let i = 0; i < headersList.length; i++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 9000);

      const res = await fetch(url, {
        signal: controller.signal,
        headers: headersList[i]
      });

      clearTimeout(timeoutId);

      if (res.ok) {
        const text = await res.text();
        if (text && !text.includes('Request Blocked') && !text.includes('Link11') && text.length > 2000) {
          console.log(`[Import Pipeline] Direct fetch attempt ${i + 1} succeeded! HTML Length: ${text.length}`);
          return { html: text, source: 'direct' };
        }
      } else {
        console.warn(`[Import Pipeline] Direct fetch attempt ${i + 1} returned status: ${res.status}`);
      }
    } catch (err: any) {
      console.warn(`[Import Pipeline] Direct fetch attempt ${i + 1} error: ${err.message}`);
    }
  }

  // Tentativa 2: Microlink API Fallback
  try {
    console.log('[Import Pipeline] Direct fetch blocked/failed. Trying Microlink API proxy fallback...');
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const mRes = await fetch("https://api.microlink.io/?url=" + encodeURIComponent(url) + "&prerender=true", {
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (mRes.ok) {
      const mData = await mRes.json();
      if (mData?.status === 'success' && mData?.data) {
        console.log('[Import Pipeline] Microlink API proxy fallback succeeded!');
        const d = mData.data;
        const syntheticHtml = `
          <!DOCTYPE html>
          <html>
            <head>
              <title>${d.title || ''}</title>
              <meta property="og:title" content="${d.title || ''}" />
              <meta property="og:description" content="${d.description || ''}" />
              <meta property="og:image" content="${d.image?.url || ''}" />
              <meta name="description" content="${d.description || ''}" />
            </head>
            <body>
              <h1>${d.title || ''}</h1>
              <p>${d.description || ''}</p>
              ${d.image?.url ? `<img src="${d.image.url}" />` : ''}
            </body>
          </html>
        `;
        return { html: syntheticHtml, source: 'microlink' };
      }
    }
  } catch (mErr: any) {
    console.warn('[Import Pipeline] Microlink fallback error:', mErr.message);
  }

  // Tentativa 3: Jina Reader Fallback
  try {
    console.log('[Import Pipeline] Trying Jina Reader proxy fallback...');
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const jRes = await fetch("https://r.jina.ai/" + url, {
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (jRes.ok) {
      const jText = await jRes.text();
      if (jText && jText.length > 500 && !jText.includes("Request Blocked")) {
        console.log('[Import Pipeline] Jina Reader fallback succeeded!');
        return { html: jText, source: 'jina' };
      }
    }
  } catch (jErr: any) {
    console.warn('[Import Pipeline] Jina fallback error:', jErr.message);
  }

  throw new Error('Não foi possível transferir o conteúdo da página do anúncio. O fornecedor bloqueou a ligação.');
}

// Helper para extração de especificações náuticas via IA ou Regras
async function extractNauticalDetails(title: string, description: string): Promise<Record<string, any>> {
  console.log('[Import Pipeline] Stage: Extracting nautical details via AI/Regex...');

  const result: Record<string, any> = {
    boatType: '',
    manufacturer: '',
    model: '',
    year: '',
    condition: '',
    length: '',
    beam: '',
    draft: '',
    fuelType: '',
    engineBrand: '',
    horsepower: '',
    engineHours: '',
    cabins: '',
    berths: '',
    bathrooms: '',
    hullMaterial: '',
    trailerIncluded: '',
    vatPaid: '',
    ceCertified: ''
  };

  const combinedText = `${title || ''}\n${description || ''}`;
  const lowerText = combinedText.toLowerCase();

  try {
    console.log('[Import Pipeline] Calling Gemini AI (gemini-2.5-flash)...');
    const { GoogleGenAI } = await import('@google/genai');
    const apiKey = process.env.GEMINI_API_KEY || "AIzaSyBewRCSZ-nNqXiaVCRzgpfI1ieWf5QEyq4";
    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: { headers: { 'User-Agent': 'aistudio-build' } }
    });

    const prompt = `Você é um motor de extração de dados náuticos de nível profissional e altíssima precisão.
Sua missão é analisar o título, tabelas de especificações, marcadores e descrição deste anúncio náutico e extrair as especificações exatas em JSON estrito.

ORDEM E PRIORIDADE DE EXTRAÇÃO:
1. Tabelas de especificações técnicas e fichas técnicas
2. Listas de características (bullet points / marcadores)
3. Seções estruturadas do anúncio
4. Descrição detalhada

REGRAS RÍGIDAS DE PRECISÃO - NUNCA INVENTE DADOS:
- A PRECISÃO É MUITO MAIS IMPORTANTE QUE A COMPLETUDE. Um campo omitido/vazio é INFINITAMENTE MELHOR do que um dado inventado, estimado ou incorreto.
- NUNCA adivinhe, estime, fabrique, presuma ou invente informações que não estejam explicitamente escritas no texto do anúncio.
- Se uma informação NÃO for mencionada no texto, retorne "" (string vazia).
- Se a confiança sobre uma informação for BAIXA, DEIXE O CAMPO VAZIO ("").

DIRETRIZES CAMPO A CAMPO:
1. boatType: Identifique pelo título, palavras-chave e contexto.
   - "Sailboat": palavras como sailboat, veleiro, barco a vela, mast, boom, rigging, keel, fin keel, bilge keel, sloop, cutter, ketch, schooner, mainsail, jib, genoa, spinnaker, tiller, furling, vela.
   - "Motorboat": motorboat, motor cruiser, cabin cruiser, speedboat, day cruiser, bowrider, cuddy, walkaround, center console, lancha, barco a motor, outboard, inboard.
   - "RIB": RIB, rigid inflatable, semirrigido, semi-rigido, inflatable boat, tender, zodiac, ribcraft.
   - "Jet Ski": jet ski, jetski, PWC, personal watercraft, waverunner, sea-doo, mota de água.
   - "Fishing Boat": fishing boat, angler, cuddy fisher, pilothouse, bass boat, traineira, barco de pesca, pescador.
   - "Catamaran": catamaran, catamarã, multihull, trimaran.
   - "Canal Boat" / "Narrowboat": canal boat, narrowboat, widebeam, barge.
   - "Yacht": superyacht, luxury yacht, iate.
   - "Houseboat": houseboat, casa flutuante.
   - "Commercial Boat": commercial boat, passenger boat, workboat.
   - "Other": caso seja outro tipo específico.
   - Se não for possível determinar com clareza, retorne "".

2. manufacturer & model:
   - Identifique com rigor o fabricante/construtor (ex: "Atlanta Marine Ltd", "Beneteau", "Jeanneau", "Bavaria Yachts", "Princess", "Quicksilver", "Sea Ray", "Bayliner", "Westerly", "Moody").
   - Identifique o modelo exato (ex: "Catch 22", "Antares 8", "Cap Camarat 6.5", "Oceanis 34.1").
   - Exemplo: em "Atlanta Catch 22 1982 sailing boat", o fabricante é "Atlanta Marine Ltd" (ou "Atlanta") e o modelo é "Catch 22".

3. year:
   - Extraia apenas o ano real de fabricação/construção (ex: "1982", "2018").
   - NUNCA extraia anos futuros (ex: 2026), nem números de telefone, códigos postais ou números de modelo (como "Model 2000").
   - Se o ano não for explicitado, retorne "".

4. length, beam, draft:
   - Extraia especificações técnicas como LOA / Comprimento total (ex: "6.71 m" ou "22 ft"), Boca / Beam / Largura (ex: "2.41 m"), Calado / Max Draft (ex: "1.2 m").
   - Mantenha as unidades (m, ft, ').

5. berths:
   - Permite calcular somas de acomodações/camas declaradas. Exemplo: "1 double berth + 2 single berths" -> "4". "Sleeps 4" -> "4". "4 berths" -> "4".
   - Se não houver informação de dormidas/camas, retorne "".

6. fuelType, engineBrand, horsepower, engineHours:
   - Extraia apenas se presente no anúncio. Se o combustível não for mencionado, retorne "".

7. trailerIncluded, vatPaid, ceCertified:
   - "Yes" APENAS se explicitamente afirmado que inclui reboque, IVA pago ou certificado CE.
   - "No" APENAS se explicitamente afirmado que NÃO inclui reboque, IVA não pago, etc.
   - Se NÃO for mencionado no anúncio, retorne "" (string vazia). NUNCA presuma "Yes" ou "No".

Retorne APENAS um objeto JSON válido com a seguinte estrutura:
{
  "boatType": "Sailboat" | "Motorboat" | "RIB" | "Jet Ski" | "Fishing Boat" | "Catamaran" | "Canal Boat" | "Narrowboat" | "Yacht" | "Houseboat" | "Commercial Boat" | "Other" | "",
  "manufacturer": "string",
  "model": "string",
  "year": "string",
  "condition": "New" | "Used - Excellent" | "Used - Good" | "Used - Fair" | "Restored / Refitted" | "Project / Needs Work" | "",
  "length": "string",
  "beam": "string",
  "draft": "string",
  "fuelType": "Diesel" | "Petrol / Gasoline" | "Electric" | "Hybrid" | "Solar" | "None / Manual" | "Other" | "",
  "engineBrand": "string",
  "horsepower": "string",
  "engineHours": "string",
  "cabins": "string",
  "berths": "string",
  "bathrooms": "string",
  "hullMaterial": "Fiberglass / GRP" | "Aluminium" | "Steel" | "Wood" | "Carbon Fibre" | "Inflatable / Hypalon" | "Composite" | "Other" | "",
  "trailerIncluded": "Yes" | "No" | "",
  "vatPaid": "Yes" | "No" | "",
  "ceCertified": "Yes" | "No" | ""
}`;

    const aiRes = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: { parts: [{ text: `${prompt}\n\nTexto do anúncio:\n${combinedText}` }] },
      config: { responseMimeType: "application/json" }
    });

    if (aiRes.text) {
      const cleanJson = aiRes.text.replace(/```json/gi, '').replace(/```/gi, '').trim();
      const parsed = JSON.parse(cleanJson);
      if (parsed && typeof parsed === 'object') {
        Object.keys(result).forEach(key => {
          if (parsed[key] !== undefined && parsed[key] !== null) {
            result[key] = String(parsed[key]).trim();
          }
        });
        console.log('[Import Pipeline] Gemini AI extraction succeeded!');
        return result;
      }
    }
  } catch (err: any) {
    console.warn("[Import Pipeline] Gemini AI extraction failed or timed out. Falling back to regex rules:", err.message);
  }

  // Fallback seguro e conservador por expressões regulares se a IA falhar
  const currentYear = new Date().getFullYear();
  const yearExplicitMatch = combinedText.match(/\b(?:year|built|built in|ano|fabrico|ano de fabrico)[:\s]*([12]\d{3})\b/i);
  if (yearExplicitMatch) {
    const yr = parseInt(yearExplicitMatch[1], 10);
    if (yr >= 1900 && yr <= currentYear) {
      result.year = String(yr);
    }
  }

  const loaMatch = combinedText.match(/\b(?:loa|length|comprimento|comprimento total)[:\s]*(\d+(?:[.,]\d+)?\s*(?:m|metres|meters|ft|feet|'))\b/i);
  if (loaMatch) {
    result.length = loaMatch[1];
  } else {
    const genericLen = combinedText.match(/\b(\d+(?:[.,]\d+)?\s*(?:m|metres|meters|ft|feet))\b/i);
    if (genericLen) result.length = genericLen[1];
  }

  const beamMatch = combinedText.match(/\b(?:beam|boca|largura)[:\s]*(\d+(?:[.,]\d+)?\s*(?:m|metres|meters|ft|feet|'))\b/i);
  if (beamMatch) result.beam = beamMatch[1];

  const draftMatch = combinedText.match(/\b(?:draft|max draft|calado)[:\s]*(\d+(?:[.,]\d+)?\s*(?:m|metres|meters|ft|feet|'))\b/i);
  if (draftMatch) result.draft = draftMatch[1];

  const hpMatch = combinedText.match(/\b(\d+)\s*(?:hp|cv|bhp|ps)\b/i);
  if (hpMatch) result.horsepower = hpMatch[0];

  const engineBrands = ['Mercury', 'Yamaha', 'Volvo Penta', 'Honda', 'Suzuki', 'Yanmar', 'Mercruiser', 'Evinrude', 'Tohatsu', 'Cummins', 'Caterpillar', 'Perkins', 'Nanni', 'Beta Marine'];
  const foundBrand = engineBrands.find(b => lowerText.includes(b.toLowerCase()));
  if (foundBrand) result.engineBrand = foundBrand;

  if (/\bdiesel\b/i.test(combinedText)) result.fuelType = 'Diesel';
  else if (/\b(?:gasolina|petrol|gasoline)\b/i.test(combinedText)) result.fuelType = 'Petrol / Gasoline';
  else if (/\b(?:eletrico|elétrico|electric)\b/i.test(combinedText)) result.fuelType = 'Electric';

  if (/\b(?:veleiro|sailboat|sailing|mast|rigging|sloop|ketch|schooner|mainsail|keel|bilge keel|fin keel)\b/i.test(combinedText)) {
    result.boatType = 'Sailboat';
  } else if (/\b(?:semirrigido|semi-rigido|rib|zodiac|ribcraft)\b/i.test(combinedText)) {
    result.boatType = 'RIB';
  } else if (/\b(?:jet ski|jetski|waverunner|pwc|sea-doo|seadoo|mota de agua)\b/i.test(combinedText)) {
    result.boatType = 'Jet Ski';
  } else if (/\b(?:catamara|catamaran|multihull|trimaran)\b/i.test(combinedText)) {
    result.boatType = 'Catamaran';
  } else if (/\b(?:iate|superyacht|luxury yacht)\b/i.test(combinedText)) {
    result.boatType = 'Yacht';
  } else if (/\b(?:barco de pesca|fishing boat|cuddy fisher|pilothouse|traineira)\b/i.test(combinedText)) {
    result.boatType = 'Fishing Boat';
  } else if (/\b(?:lancha|barco a motor|motorboat|motor cruiser|speed boat|day cruiser)\b/i.test(combinedText)) {
    result.boatType = 'Motorboat';
  }

  const builders = ['Atlanta Marine', 'Atlanta', 'Beneteau', 'Jeanneau', 'Quicksilver', 'Bayliner', 'Sea Ray', 'Bavaria', 'Yamaha', 'Sessa', 'Princess', 'Sunseeker', 'Azimut', 'Boston Whaler', 'Ranieri', 'Capelli', 'Zodiac', 'Mastercraft', 'Monterey', 'Chaparral', 'Regal', 'Westerly', 'Moody', 'Sadler', 'Hunter', 'Hanse', 'Dufour', 'Hallberg-Rassy', 'Catalina', 'MacGregor', 'Fairline', 'Sealine', 'Orkney', 'Fletcher'];
  const foundBuilder = builders.find(b => lowerText.includes(b.toLowerCase()));
  if (foundBuilder) result.manufacturer = foundBuilder;

  const berthMatch = combinedText.match(/\b(\d+)\s*(?:berths?|camas?|dormidas?|sleeps)\b/i);
  if (berthMatch) {
    result.berths = berthMatch[1];
  } else {
    const dbl = combinedText.match(/\b(\d+)\s*double\b/i);
    const sgl = combinedText.match(/\b(\d+)\s*single\b/i);
    if (dbl || sgl) {
      const numDbl = dbl ? parseInt(dbl[1], 10) : 0;
      const numSgl = sgl ? parseInt(sgl[1], 10) : 0;
      const total = numDbl * 2 + numSgl;
      if (total > 0) result.berths = String(total);
    }
  }

  if (/\b(?:reboque incl|trailer incl|com reboque|with trailer|trailer included)\b/i.test(combinedText)) result.trailerIncluded = 'Yes';
  else if (/\b(?:sem reboque|no trailer|without trailer)\b/i.test(combinedText)) result.trailerIncluded = 'No';

  if (/\b(?:iva pago|vat paid|vat included|iva incluido)\b/i.test(combinedText)) result.vatPaid = 'Yes';
  else if (/\b(?:sem iva|plus vat|\+ vat|acresce iva)\b/i.test(combinedText)) result.vatPaid = 'No';

  if (/\b(?:certificado ce|ce certified|ce mark|categoria ce)\b/i.test(combinedText)) result.ceCertified = 'Yes';

  return result;
}

// Handler Serverless Function da Vercel / Express
export default async function handler(req: any, res: any) {
  // Configuração de CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    console.log('[Import Pipeline] Stage 1: Request received');
    const { url, userRole } = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});

    // Verificação de permissões
    if (userRole !== 'admin' && userRole !== 'moderator') {
      console.warn('[Import Pipeline Failure] Permission denied for role:', userRole);
      return res.status(403).json({ 
        success: false, 
        stage: 'Permission Validation',
        error: 'Acesso negado. Apenas administradores ou moderadores podem realizar a importação.' 
      });
    }

    if (!url) {
      return res.status(400).json({ success: false, stage: 'URL Validation', error: "Falta o link do anúncio." });
    }

    const lowerUrl = url.toLowerCase();
    const isOlx = lowerUrl.includes('olx.pt');
    const isGumtree = lowerUrl.includes('gumtree.com') || lowerUrl.includes('gumtree.co.uk');
    const isTestUrl = lowerUrl.includes('teste.mercadoluso.com') || lowerUrl.includes('teste.mercadoluso');

    if (!isOlx && !isGumtree && !isTestUrl) {
      return res.status(200).json({
        success: false,
        stage: 'Platform Support Check',
        error: 'Esta plataforma ainda não é suportada. No momento, suportamos apenas OLX e Gumtree.'
      });
    }

    // Suporte a URLs de teste para simulação e homologação local/preview
    if (isTestUrl) {
      console.log('[Import Pipeline] Handling test URL preview mode...');
      return res.status(200).json({
        success: true,
        stage: 'Complete',
        data: {
          title: "Beneteau Antares 8 OB (2021) - Mercury 200 HP",
          description: "Beneteau Antares 8 OB em estado imaculado, ano 2021. Equipado com motor fora-de-borda Mercury Verado 200 HP com 140 horas de navegação.\n\nFicha Técnica:\n- Comprimento: 8.23 m | Boca: 2.76 m | Calado: 0.80 m\n- Casco em Fibra de Vidro (GRP)\n- 1 Cabine, 4 Camas, 1 WC elétrico\n- Reboque incluído e IVA pago.",
          price: 68500,
          category: "Carros, motos e barcos",
          city: "Faro",
          country: "Portugal",
          images: [
            "https://images.unsplash.com/photo-1569263979104-865ab7cd8d13?w=800&auto=format&fit=crop&q=60",
            "https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?w=800&auto=format&fit=crop&q=60"
          ],
          boatType: "Motorboat",
          manufacturer: "Beneteau",
          model: "Antares 8 OB",
          year: "2021",
          condition: "Used - Excellent",
          length: "8.23 m",
          beam: "2.76 m",
          draft: "0.80 m",
          fuelType: "Petrol / Gasoline",
          engineBrand: "Mercury",
          horsepower: "200 HP",
          engineHours: "140 h",
          cabins: "1",
          berths: "4",
          bathrooms: "1",
          hullMaterial: "Fiberglass / GRP",
          trailerIncluded: "Yes",
          vatPaid: "Yes",
          ceCertified: "Yes"
        }
      });
    }

    // Stage 2: Fetch HTML
    let responseText = '';
    try {
      const fetchResult = await fetchAdHtml(url);
      responseText = fetchResult.html;
    } catch (fetchErr: any) {
      console.error("[Import Pipeline Failure Stage 2 - Fetch HTML]:", fetchErr.message);
      return res.status(200).json({
        success: false,
        stage: 'Fetching HTML',
        error: 'Não foi possível importar os dados deste anúncio. O servidor de origem recusou a ligação.'
      });
    }

    // Stage 3: Parse Metadata & JSON-LD
    console.log('[Import Pipeline] Stage 3: Parsing metadata & JSON-LD...');
    const jsonLdList = extractJsonLd(responseText);
    const productNode = extractFromJsonLdList(jsonLdList);

    // Extração de Título
    let rawTitle = extractMetaContent(responseText, 'og:title');
    if (!rawTitle) {
      rawTitle = productNode?.name || productNode?.title || extractMetaContent(responseText, 'twitter:title') || '';
    }
    if (!rawTitle) {
      const titleMatch = responseText.match(/<title>([^<]+)<\/title>/i);
      rawTitle = titleMatch ? titleMatch[1] : '';
    }
    let title = cleanTitle(rawTitle);
    if (!title && rawTitle) {
      title = decodeHtmlEntities(rawTitle).trim();
    }

    if (!title) {
      console.error("[Import Pipeline Failure Stage 3 - Title Extraction]: Title empty");
      return res.status(200).json({
        success: false,
        stage: 'Parsing HTML',
        error: 'Não foi possível extrair o título do anúncio. Verifique se o link está ativo.'
      });
    }

    // Extração de Descrição
    let foundDescription = extractMetaContent(responseText, 'og:description');
    if (!foundDescription) {
      foundDescription = productNode?.description || extractMetaContent(responseText, 'twitter:description') || extractMetaContent(responseText, 'description') || '';
    }
    const description = cleanDescription(foundDescription);

    // Extração de Preço
    let price = 0;
    const ogPriceAmount = extractMetaContent(responseText, 'product:price:amount');
    if (ogPriceAmount) {
      price = parsePrice(ogPriceAmount);
    }
    if (price === 0) {
      if (productNode?.offers?.price !== undefined) {
        price = parsePrice(productNode.offers.price);
      } else if (productNode?.offers?.[0]?.price !== undefined) {
        price = parsePrice(productNode.offers[0].price);
      }
    }
    if (price === 0 && (rawTitle || responseText)) {
      const priceMatch = (rawTitle + ' ' + responseText).match(/(?:€|\$|£)\s*(\d+(?:[.,]\d+)?)|(\d+(?:[.,]\d+)?)\s*(?:€|\$|£)/);
      if (priceMatch) {
        price = parsePrice(priceMatch[1] || priceMatch[2]);
      }
    }

    // Mapeamento de Categoria
    let parsedCategory = productNode?.category || '';
    if (!parsedCategory) {
      for (const obj of jsonLdList) {
        if (obj?.itemListElement && Array.isArray(obj.itemListElement)) {
          const sortedItems = [...obj.itemListElement].sort((a,b) => (a.position || 0) - (b.position || 0));
          if (sortedItems.length > 1) {
            parsedCategory = sortedItems[1].name || sortedItems[1].item?.name || '';
          }
        }
      }
    }
    if (!parsedCategory) {
      parsedCategory = extractMetaContent(responseText, 'category') || '';
    }

    let category = 'Carros, motos e barcos'; // Categoria padrão para anúncios náuticos
    const lowerParsedCat = String(parsedCategory).toLowerCase() + ' ' + title.toLowerCase() + ' ' + description.toLowerCase();

    if (lowerParsedCat.includes('carro') || lowerParsedCat.includes('moto') || lowerParsedCat.includes('barco') || lowerParsedCat.includes('veiculo') || lowerParsedCat.includes('auto') || lowerParsedCat.includes('peças') || lowerParsedCat.includes('pneus') || lowerParsedCat.includes('jantes') || lowerParsedCat.includes('motociclo') || lowerParsedCat.includes('car ') || lowerParsedCat.includes('cars ') || lowerParsedCat.includes('vehicle') || lowerParsedCat.includes('motor') || lowerParsedCat.includes('van') || lowerParsedCat.includes('wheel') || lowerParsedCat.includes('tyre') || lowerParsedCat.includes('boat') || lowerParsedCat.includes('sailing')) {
      category = 'Carros, motos e barcos';
    } else if (lowerParsedCat.includes('imovel') || lowerParsedCat.includes('apartamento') || lowerParsedCat.includes('casa') || lowerParsedCat.includes('moradia') || lowerParsedCat.includes('quarto') || lowerParsedCat.includes('terreno') || lowerParsedCat.includes('loja') || lowerParsedCat.includes('garagem') || lowerParsedCat.includes('escritório') || lowerParsedCat.includes('prédio') || lowerParsedCat.includes('property') || lowerParsedCat.includes('flat') || lowerParsedCat.includes('house') || lowerParsedCat.includes('rent') || lowerParsedCat.includes('room') || lowerParsedCat.includes('studio')) {
      category = 'Imóveis';
    } else if (lowerParsedCat.includes('telemovel') || lowerParsedCat.includes('iphone') || lowerParsedCat.includes('samsung') || lowerParsedCat.includes('computador') || lowerParsedCat.includes('tecnologia') || lowerParsedCat.includes('eletronica') || lowerParsedCat.includes('tablet') || lowerParsedCat.includes('tv') || lowerParsedCat.includes('laptop') || lowerParsedCat.includes('smartphone') || lowerParsedCat.includes('consola') || lowerParsedCat.includes('playstation') || lowerParsedCat.includes('nintendo') || lowerParsedCat.includes('xbox') || lowerParsedCat.includes('phone') || lowerParsedCat.includes('computer') || lowerParsedCat.includes('tv ') || lowerParsedCat.includes('console') || lowerParsedCat.includes('camera') || lowerParsedCat.includes('electronics')) {
      category = 'Tecnologia';
    } else if (lowerParsedCat.includes('jardim') || lowerParsedCat.includes('moveis') || lowerParsedCat.includes('móveis') || lowerParsedCat.includes('decoracao') || lowerParsedCat.includes('decoração') || lowerParsedCat.includes('eletrodomestico') || lowerParsedCat.includes('eletrodoméstico') || lowerParsedCat.includes('diy') || lowerParsedCat.includes('ferramenta') || lowerParsedCat.includes('bricolage') || lowerParsedCat.includes('sofá') || lowerParsedCat.includes('mesa') || lowerParsedCat.includes('cadeira') || lowerParsedCat.includes('cama') || lowerParsedCat.includes('garden') || lowerParsedCat.includes('furniture') || lowerParsedCat.includes('home') || lowerParsedCat.includes('sofa') || lowerParsedCat.includes('table') || lowerParsedCat.includes('chair') || lowerParsedCat.includes('bed') || lowerParsedCat.includes('appliance')) {
      category = 'Casa e Jardim';
    }

    // Extração de Cidade
    let city: string | null = null;
    let foundCity = findLocationInJsonLd(jsonLdList) || extractMetaContent(responseText, 'og:locality') || extractMetaContent(responseText, 'geo.placename');
    
    if (!foundCity) {
      const localityMatch = responseText.match(/"addressLocality"\s*:\s*"([^"]+)"/i) || responseText.match(/"addressRegion"\s*:\s*"([^"]+)"/i) || responseText.match(/"cityName"\s*:\s*"([^"]+)"/i);
      if (localityMatch) {
        foundCity = localityMatch[1];
      }
    }

    if (foundCity) {
      const normCity = decodeHtmlEntities(String(foundCity)).trim().toLowerCase();
      if (isGumtree) {
        const allUkCities = [
          'London', 'Manchester', 'Birmingham', 'Liverpool', 'Leeds', 'Bristol', 
          'Southampton', 'Portsmouth', 'Bournemouth', 'Reading', 'Milton Keynes', 
          'Leicester', 'Coventry', 'Nottingham', 'Glasgow', 'Edinburgh', 'Cardiff', 
          'Belfast', 'Weymouth', 'Aberdeen', 'Ayr', 'Bangor', 'Blackpool'
        ];
        const matched = allUkCities.find(c => c.toLowerCase() === normCity || normCity.includes(c.toLowerCase()));
        city = matched ? matched : (normCity.includes('london') ? 'London' : decodeHtmlEntities(String(foundCity)).trim());
      } else {
        const allPortugalCities = ['Lisboa', 'Porto', 'Braga', 'Faro', 'Coimbra', 'Aveiro', 'Setúbal', 'Leiria', 'Madeira', 'Açores', 'Outra'];
        const matched = allPortugalCities.find(c => c.toLowerCase() === normCity || normCity.includes(c.toLowerCase()));
        city = matched ? matched : decodeHtmlEntities(String(foundCity)).trim();
      }
    }

    if (!city) {
      city = isGumtree ? 'London' : 'Lisboa';
    }

    // Extração de Imagens
    let images: string[] = [];
    const ogImage = extractMetaContent(responseText, 'og:image');
    if (ogImage) images.push(ogImage);

    if (productNode?.image) {
      if (Array.isArray(productNode.image)) {
        productNode.image.forEach((img: any) => {
          const urlStr = typeof img === 'string' ? img : (typeof img === 'object' && img?.url ? img.url : '');
          if (urlStr) images.push(urlStr);
        });
      } else if (typeof productNode.image === 'string') {
        images.push(productNode.image);
      } else if (typeof productNode.image === 'object' && productNode.image?.url) {
        images.push(productNode.image.url);
      }
    }

    const twitterImg = extractMetaContent(responseText, 'twitter:image');
    if (twitterImg) images.push(twitterImg);
    
    const htmlImgMatches = responseText.match(/https?:\/\/[^\s"'>]+?\.olx\.pt\/v1\/files\/[a-zA-Z0-9_-]+\/image;[^\s"'>\)]*/gi) || [];
    for (const mUrl of htmlImgMatches) images.push(mUrl);

    if (isGumtree) {
      const ebayImgMatches = responseText.match(/https?:\/\/(?:i\.ebayimg\.com|img\.gumtree\.com|img\.gumtree\.co\.uk)[^\s"';,>]+/gi) || [];
      for (const mUrl of ebayImgMatches) images.push(mUrl);
    }

    const isValidImageUrl = (imgUrl: string): boolean => {
      if (!imgUrl || typeof imgUrl !== 'string') return false;
      try {
        const decoded = decodeHtmlEntities(imgUrl).trim();
        if (!decoded.startsWith('http://') && !decoded.startsWith('https://')) return false;
        const parsed = new URL(decoded);
        return parsed.protocol === 'http:' || parsed.protocol === 'https:';
      } catch (e) {
        return false;
      }
    };

    images = Array.from(new Set(images.map(img => decodeHtmlEntities(img).trim())))
      .filter(img => isValidImageUrl(img))
      .slice(0, 10);

    const countryResult = isGumtree ? 'Reino Unido' : isOlx ? 'Portugal' : null;

    // Stage 4: Extract Nautical Specifications via AI
    const nauticalDetails = await extractNauticalDetails(title, description);

    console.log('[Import Pipeline] Stage 5: Import completed successfully!');

    return res.status(200).json({
      success: true,
      stage: 'Complete',
      data: {
        title,
        description,
        price,
        category,
        city,
        country: countryResult,
        images,
        ...nauticalDetails
      }
    });
  } catch (err: any) {
    console.error("[Import Pipeline Exception]:", err);
    return res.status(200).json({ 
      success: false, 
      stage: 'Server Exception', 
      error: 'Não foi possível importar os dados deste anúncio. Preencha manualmente.' 
    });
  }
}
