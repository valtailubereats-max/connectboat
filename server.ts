import express from 'express';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';

// Carregar variáveis de ambiente de .env
dotenv.config();

import importAdHandler from './api/import-ad.ts';
import discoverListingsHandler from './api/discover-listings.ts';
import geminiAnalyzeHandler from './api/gemini/analyze.ts';
import emailSendHandler from './api/email/send.ts';
import productSeoHandler from './api/product-seo.ts';
import seoHandler from './api/seo.ts';
import sitemapHandler from './api/sitemap.ts';
import createCheckoutSessionHandler from './api/stripe/create-checkout-session.ts';
import stripeWebhookHandler from './api/stripe/webhook.ts';

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  // Middlewares de parse JSON e URL Encoded para requisições das APIs (preservando rawBody para webhook do Stripe)
  app.use(express.json({
    limit: '20mb',
    verify: (req: any, _res, buf) => {
      req.rawBody = buf;
    }
  }));
  app.use(express.urlencoded({ extended: true, limit: '20mb' }));

  // Middleware para capturar erros de sintaxe de JSON do body-parser em rotas /api/*
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    const isApiRoute = (req.originalUrl && req.originalUrl.startsWith('/api/')) ||
                       (req.path && req.path.startsWith('/api/')) ||
                       (req.url && req.url.startsWith('/api/'));
    if (err && isApiRoute) {
      res.setHeader('Content-Type', 'application/json');
      return res.status(err.status || 400).json({
        success: false,
        error: 'INVALID_JSON_PAYLOAD',
        errorMessage: 'O corpo do pedido em formato JSON é inválido.'
      });
    }
    next(err);
  });

  // Middleware global para rotas de API: CORS e cabeçalhos de resposta
  app.use('/api/*', (req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }
    next();
  });

  // Rotas de API Backend
  app.all('/api/discover-listings', async (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    try {
      await discoverListingsHandler(req as any, res as any);
    } catch (err: any) {
      console.error('[Server Error /api/discover-listings]:', err);
      if (!res.headersSent) {
        res.status(500).json({ success: false, error: 'SERVER_ERROR', errorMessage: err.message || 'Erro interno no servidor' });
      }
    }
  });

  app.post('/api/import-ad', async (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    try {
      await importAdHandler(req, res);
    } catch (err: any) {
      console.error('[Server Error /api/import-ad]:', err);
      if (!res.headersSent) {
        res.status(500).json({ success: false, stage: 'Server Exception', error: err.message || 'Erro interno no servidor' });
      }
    }
  });

  app.post('/api/gemini/analyze', async (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    try {
      await geminiAnalyzeHandler(req, res);
    } catch (err: any) {
      console.error('[Server Error /api/gemini/analyze]:', err);
      if (!res.headersSent) {
        res.status(500).json({ success: false, error: err.message || 'Erro interno no servidor' });
      }
    }
  });

  app.post('/api/email/send', async (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    try {
      await emailSendHandler(req, res);
    } catch (err: any) {
      console.error('[Server Error /api/email/send]:', err);
      if (!res.headersSent) {
        res.status(500).json({ success: false, error: err.message || 'Erro interno no servidor' });
      }
    }
  });

  app.post('/api/stripe/create-checkout-session', async (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    try {
      await createCheckoutSessionHandler(req, res);
    } catch (err: any) {
      console.error('[Server Error /api/stripe/create-checkout-session]:', err);
      if (!res.headersSent) {
        res.status(500).json({ success: false, error: err.message || 'Erro interno no servidor' });
      }
    }
  });

  app.post('/api/stripe/webhook', async (req, res) => {
    try {
      await stripeWebhookHandler(req as any, res as any);
    } catch (err: any) {
      console.error('[Server Error /api/stripe/webhook]:', err);
      if (!res.headersSent) {
        res.status(400).send(`Webhook Error: ${err.message}`);
      }
    }
  });

  app.all('/api/product-seo', async (req, res) => {
    try {
      await productSeoHandler(req as any, res as any);
    } catch (err: any) {
      console.error('[Server Error /api/product-seo]:', err);
      if (!res.headersSent) {
        res.status(500).send('Internal Server Error');
      }
    }
  });

  app.all('/api/seo', async (req, res) => {
    try {
      await seoHandler(req as any, res as any);
    } catch (err: any) {
      console.error('[Server Error /api/seo]:', err);
      if (!res.headersSent) {
        res.status(500).send('Internal Server Error');
      }
    }
  });

  app.get(['/sitemap.xml', '/api/sitemap'], async (req, res) => {
    try {
      await sitemapHandler(req as any, res as any);
    } catch (err: any) {
      console.error('[Server Error /sitemap]:', err);
      if (!res.headersSent) {
        res.status(500).send('Internal Server Error');
      }
    }
  });

  app.get('/api/health', (_req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Handler de segurança 404 exclusivo para rotas de API: impede que chamadas /api/* caiam no index.html da SPA
  app.all('/api/*', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.status(404).json({
      success: false,
      error: `API endpoint não encontrado: ${req.method} ${req.originalUrl}`
    });
  });

  // Handler global de erros em rotas de API: garante sempre resposta JSON
  app.use('/api/*', (err: any, req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error('[Global API Exception]:', err);
    res.setHeader('Content-Type', 'application/json');
    if (!res.headersSent) {
      res.status(err.status || 500).json({
        success: false,
        error: 'SERVER_ERROR',
        errorMessage: err.message || 'Erro interno no servidor'
      });
    }
  });

  // Reescritas para crawlers de redes sociais (OpenGraph/Twitter Cards)
  const crawlerUserAgents = /facebookexternalhit|twitterbot|linkedinbot|whatsapp|telegrambot|slackbot|discordbot|bingbot|googlebot/i;

  app.get(['/anuncio/:slugAndId', '/listing/:slugAndId'], async (req, res, next) => {
    const userAgent = req.headers['user-agent'] || '';
    if (crawlerUserAgents.test(userAgent)) {
      try {
        return await seoHandler(req as any, res as any);
      } catch (e) {
        console.error('Erro ao servir SEO de anúncio para crawler:', e);
      }
    }
    next();
  });

  app.get('/empreendedores/:showcaseSlug/produto/:productId', async (req, res, next) => {
    const userAgent = req.headers['user-agent'] || '';
    if (crawlerUserAgents.test(userAgent)) {
      try {
        return await productSeoHandler(req as any, res as any);
      } catch (e) {
        console.error('Erro ao servir SEO de produto para crawler:', e);
      }
    }
    next();
  });

  // Servidor estático em produção vs middleware do Vite em desenvolvimento
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath, { index: false }));
    app.get('*', (req, res) => {
      if (req.originalUrl.startsWith('/api/') || req.path.startsWith('/api/')) {
        res.setHeader('Content-Type', 'application/json');
        return res.status(404).json({
          success: false,
          error: `API endpoint não encontrado: ${req.method} ${req.originalUrl}`
        });
      }
      const indexPath = path.join(distPath, 'index.html');
      if (fs.existsSync(indexPath)) {
        let rawHtml = fs.readFileSync(indexPath, 'utf-8');
        const canonicalUrl = `https://connectboat.co.uk${req.path === '/' ? '/' : req.path}`;
        rawHtml = rawHtml.replace(
          /<link rel="canonical" href="[^"]*"/i,
          `<link rel="canonical" href="${canonicalUrl}"`
        );
        rawHtml = rawHtml.replace(
          /<meta property="og:url" content="[^"]*"/i,
          `<meta property="og:url" content="${canonicalUrl}"`
        );
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        return res.send(rawHtml);
      }
      res.sendFile(indexPath);
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[ConnectBoat Server] Escutando em http://0.0.0.0:${PORT} (NODE_ENV=${process.env.NODE_ENV || 'development'})`);
  });
}

startServer();
