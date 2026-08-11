import { GoogleGenAI } from "@google/genai";
import { cert, getApp, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

const FIREBASE_PROJECT_ID = "navlink-489413";
const FIRESTORE_DATABASE_ID = "ai-studio-boatmarket-b1c69205-2a63-42a8-922c-14b64e4cb382";

function getFirebaseAdminApp() {
  if (!getApps().length) {
    const rawServiceAccount = process.env.FIREBASE_SERVICE_ACCOUNT;

    if (!rawServiceAccount) {
      throw new Error("FIREBASE_SERVICE_ACCOUNT environment variable is missing.");
    }

    let serviceAccount: any;
    try {
      serviceAccount = JSON.parse(rawServiceAccount);
    } catch {
      serviceAccount = JSON.parse(
        Buffer.from(rawServiceAccount, "base64").toString("utf-8")
      );
    }

    if (typeof serviceAccount.private_key === "string") {
      serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, "\n");
    }

    initializeApp({
      credential: cert(serviceAccount),
      projectId: FIREBASE_PROJECT_ID,
    });
  }

  return getApp();
}

async function verifyAdminRequest(req: any) {
  const authHeader = req.headers?.authorization || "";
  const match = authHeader.match(/^Bearer\s+(.+)$/i);

  if (!match) {
    const error: any = new Error("Authentication required.");
    error.statusCode = 401;
    throw error;
  }

  const app = getFirebaseAdminApp();

  let decoded: any;
  try {
    decoded = await getAuth(app).verifyIdToken(match[1]);
  } catch {
    const error: any = new Error("Invalid or expired Firebase authentication token.");
    error.statusCode = 401;
    throw error;
  }

  const email = typeof decoded.email === "string"
    ? decoded.email.trim().toLowerCase()
    : "";

  const explicitAdminEmails = new Set([
    "valtailubereats@gmail.com",
    "valtail@gmail.com",
    "generalsales2021@gmail.com",
  ]);

  if (explicitAdminEmails.has(email)) {
    return decoded;
  }

  const db = getFirestore(app, FIRESTORE_DATABASE_ID);
  const userDoc = await db.collection("users").doc(decoded.uid).get();
  const role = userDoc.exists ? userDoc.data()?.role : null;

  if (role !== "admin") {
    const error: any = new Error("Administrator access required.");
    error.statusCode = 403;
    throw error;
  }

  return decoded;
}


export default async function handler(req: any, res: any) {
  // Configuração rápida de CORS para segurança e compatibilidade
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    await verifyAdminRequest(req);
  } catch (authError: any) {
    return res.status(authError?.statusCode || 401).json({
      success: false,
      error: authError?.message || "Authentication failed.",
    });
  }

  try {
    const { image, categories } = req.body;

    if (!image) {
      return res.status(400).json({ error: "Falta a imagem do print." });
    }

    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      throw new Error("GEMINI_API_KEY não está configurada no servidor.");
    }

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });

    const base64Data = image.includes(",") ? image.split(",")[1] : image;

    const prompt = `Você é um motor profissional de extração de dados náuticos de altíssima precisão.
Sua função é analisar o print de anúncio fornecido (título, tabelas, especificações e texto) e extrair informações exatas da embarcação em JSON estrito.

REGRAS RÍGIDAS DE PRECISÃO - NUNCA INVENTE DADOS:
- A PRECISÃO É MUITO MAIS IMPORTANTE QUE A COMPLETUDE. A omissão de um valor é INFINITAMENTE MELHOR do que um dado fictício ou incorreto.
- NUNCA adivinhe, estime, fabrique, presuma ou invente informações que não estejam visíveis na imagem.
- Se uma informação NÃO estiver legível ou presente na imagem, retorne "" (string vazia) ou null.
- trailerIncluded, vatPaid e ceCertified: Retorne "Yes" se explicitamente afirmado, "No" se explicitamente negado, ou "" (string vazia) se não mencionado. NUNCA presuma "Yes" ou "No".
- berths: É PERMITIDO somar acomodações explicitamente declaradas na imagem (ex: "1 double berth + 2 single berths" = "4").

Campos a extrair:
- title: Título do produto ou anúncio
- price: Preço (apenas número)
- description: Descrição detalhada do anúncio
- city: Cidade ou localidade legível
- category: Escolha a mais próxima de: ${categories ? categories.join(", ") : "Carros, motos e barcos"}
- boatType: Tipo de barco ("Sailboat", "Motorboat", "RIB", "Jet Ski", "Fishing Boat", "Catamaran", "Canal Boat", "Narrowboat", "Yacht", "Houseboat", "Commercial Boat", "Other" ou "")
- manufacturer: Marca/Fabricante/Construtor do barco (ex: "Atlanta Marine Ltd", "Beneteau", "Jeanneau", "Bavaria", "Princess", "Quicksilver")
- model: Modelo exato (ex: "Catch 22", "Antares 8", "Cap Camarat 6.5")
- year: Ano de fabricação (número inteiro ex: 1982 ou null/"" se não informado. NUNCA invente ou use anos futuros)
- condition: Estado do barco ("New", "Used - Excellent", "Used - Good", "Used - Fair", "Restored / Refitted", "Project / Needs Work" ou "")
- length: Comprimento total LOA (ex: "6.71 m" ou "22 ft")
- beam: Boca / Largura (ex: "2.41 m")
- draft: Calado / Draft (ex: "1.2 m")
- fuelType: Combustível ("Diesel", "Petrol / Gasoline", "Electric", "Hybrid", "Solar", "None / Manual" ou "")
- engineBrand: Marca do motor (ex: "Mercury", "Yamaha", "Volvo Penta", "Honda", "Suzuki", "Yanmar")
- horsepower: Potência do motor (ex: "200 HP" ou "150 CV")
- engineHours: Horas de uso do motor (ex: "150 h")
- cabins: Número de cabines
- berths: Número de camas/berths total
- bathrooms: Número de casas de banho/WCs
- hullMaterial: Material do casco ("Fiberglass / GRP", "Aluminium", "Steel", "Wood", "Carbon Fibre", "Inflatable / Hypalon", "Composite", "Other" ou "")
- trailerIncluded: "Yes" | "No" | ""
- vatPaid: "Yes" | "No" | ""
- ceCertified: "Yes" | "No" | ""

Estrutura JSON esperada:
{
  "title": "string",
  "price": number,
  "description": "string",
  "city": "string",
  "category": "string",
  "boatType": "string",
  "manufacturer": "string",
  "model": "string",
  "year": number | null,
  "condition": "string",
  "length": "string",
  "beam": "string",
  "draft": "string",
  "fuelType": "string",
  "engineBrand": "string",
  "horsepower": "string",
  "engineHours": "string",
  "cabins": "string",
  "berths": "string",
  "bathrooms": "string",
  "hullMaterial": "string",
  "trailerIncluded": "Yes" | "No" | "",
  "vatPaid": "Yes" | "No" | "",
  "ceCertified": "Yes" | "No" | ""
}`;

    const imagePart = {
      inlineData: {
        mimeType: "image/jpeg",
        data: base64Data,
      },
    };

    const textPart = {
      text: prompt,
    };

    let response;

    try {
      response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: { parts: [imagePart, textPart] },
        config: {
          responseMimeType: "application/json",
        },
      });
    } catch (err: any) {
      console.warn("Gemini falhou:", err.message);
      throw err;
    }

    const text = response.text;

    if (!text) {
      throw new Error("A IA retornou uma resposta sem texto.");
    }

    const cleanJson = text
      .replace(/```json/gi, "")
      .replace(/```/gi, "")
      .trim();

    const extractedData = JSON.parse(cleanJson);

    return res.status(200).json({
      success: true,
      data: extractedData,
    });
  } catch (err: any) {
    console.error("Erro na análise do Gemini na Vercel Function:", err);

    return res.status(200).json({
      success: false,
      error: `Falha na IA no servidor: ${
        err.message || "Verifique a chave de API"
      }`,
    });
  }
}
