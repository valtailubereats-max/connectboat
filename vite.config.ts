import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [
      react(), 
      tailwindcss(),
      {
        name: 'local-api-emulator',
        configureServer(server) {
          server.middlewares.use(async (req, res, next) => {
            if (req.url?.startsWith('/api/import-ad') && req.method === 'POST') {
              let body = '';
              req.on('data', chunk => { body += chunk; });
              req.on('end', async () => {
                try {
                  const parsed = body ? JSON.parse(body) : {};
                  const { default: handler } = await import('./api/import-ad.ts');
                  const mockRes = {
                    setHeader(key: string, val: string) {
                      res.setHeader(key, val);
                    },
                    status(code: number) {
                      res.statusCode = code;
                      res.setHeader('Content-Type', 'application/json');
                      return this;
                    },
                    json(payload: any) {
                      if (!res.headersSent) {
                        res.setHeader('Content-Type', 'application/json');
                      }
                      res.end(JSON.stringify(payload));
                      return this;
                    },
                    end() {
                      res.end();
                    }
                  };
                  await handler({ method: 'POST', body: parsed, headers: req.headers }, mockRes);
                } catch (err: any) {
                  console.error("[Emulator] Error in /api/import-ad:", err);
                  res.statusCode = 500;
                  res.setHeader('Content-Type', 'application/json');
                  res.end(JSON.stringify({ success: false, stage: 'Server Execution', error: err.message || 'Erro inesperado ao importar anúncio.' }));
                }
              });
            } else if (req.url?.startsWith('/api/gemini/analyze') && req.method === 'POST') {
              let body = '';
              req.on('data', chunk => { body += chunk; });
              req.on('end', async () => {
                try {
                  const parsed = JSON.parse(body || '{}');
                  const { default: handler } = await import('./api/gemini/analyze.ts');
                  const mockRes = {
                    setHeader(key: string, val: string) {
                      res.setHeader(key, val);
                    },
                    status(code: number) {
                      res.statusCode = code;
                      res.setHeader('Content-Type', 'application/json');
                      return this;
                    },
                    json(payload: any) {
                      if (!res.headersSent) {
                        res.setHeader('Content-Type', 'application/json');
                      }
                      res.end(JSON.stringify(payload));
                      return this;
                    },
                    end() {
                      res.end();
                    }
                  };
                  await handler({ method: 'POST', body: parsed, headers: req.headers }, mockRes);
                } catch (err: any) {
                  console.error("[Emulator] Erro na requisição do Gemini:", err);
                  res.statusCode = 500;
                  res.setHeader('Content-Type', 'application/json');
                  res.end(JSON.stringify({ success: false, error: err.message || 'Erro inesperado' }));
                }
              });
            } else if (req.url?.startsWith('/api/email/send') && req.method === 'POST') {
              let body = '';
              req.on('data', chunk => { body += chunk; });
              req.on('end', async () => {
                try {
                  const parsed = JSON.parse(body || '{}');
                  const { default: handler } = await import('./api/email/send.ts');
                  const mockRes = {
                    setHeader(key: string, val: string) {
                      res.setHeader(key, val);
                    },
                    status(code: number) {
                      res.statusCode = code;
                      res.setHeader('Content-Type', 'application/json');
                      return this;
                    },
                    json(payload: any) {
                      if (!res.headersSent) {
                        res.setHeader('Content-Type', 'application/json');
                      }
                      res.end(JSON.stringify(payload));
                      return this;
                    },
                    end() {
                      res.end();
                    }
                  };
                  await handler({ method: 'POST', body: parsed, headers: req.headers }, mockRes);
                } catch (err: any) {
                  console.error("[Emulator] Erro no emulador de email:", err);
                  res.statusCode = 500;
                  res.setHeader('Content-Type', 'application/json');
                  res.end(JSON.stringify({ success: false, error: err.message || 'Erro no emulador de email' }));
                }
              });
            } else if (req.url?.startsWith('/api/health')) {
              res.statusCode = 200;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ status: "ok" }));
            } else {
              next();
            }
          });
        }
      }
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      port: 3000,
      host: '0.0.0.0',
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
