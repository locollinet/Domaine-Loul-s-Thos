import express from 'express';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createCopilotRouter } from './server/copilot';

try {
  if (typeof process.loadEnvFile === 'function' && fs.existsSync('.env')) {
    process.loadEnvFile();
  }
} catch {
  // Ignore missing or unreadable .env in container/runtime environments
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const httpServer = http.createServer(app);
  const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
  const isProd = process.env.NODE_ENV === 'production';
  const hmrDisabled = process.env.DISABLE_HMR === 'true';

  app.use(express.json({ limit: '256kb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, copilotConfigured: Boolean(process.env.GEMINI_API_KEY?.trim()) });
  });

  app.use('/api/copilot', createCopilotRouter());

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        ...(hmrDisabled ? { hmr: false, ws: false } : { ws: { server: httpServer } }),
        watch: hmrDisabled ? null : {},
      },
      appType: 'spa',
    });
    if (hmrDisabled) {
      app.get('/@vite/client', async (_req, res, next) => {
        try {
          const transformed = await vite.transformRequest('/@vite/client');
          if (!transformed) {
            next();
            return;
          }
          // Vite 8 in middlewareMode with hmr:false/ws:false still emits transport.connect() to port 24678
          const patched = transformed.code.replace(
            /transport\.connect\([^;]+\);/,
            '/* HMR disabled: WebSocket transport skipped */'
          );
          res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
          res.setHeader('Cache-Control', 'no-cache');
          res.send(patched);
        } catch (err) {
          next(err);
        }
      });
    }
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.use((req, res, next) => {
      if (req.method !== 'GET' || req.path.startsWith('/api/')) {
        next();
        return;
      }
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  httpServer.listen(port, '0.0.0.0', () => {
    console.log(`Domaine server listening on http://0.0.0.0:${port}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
