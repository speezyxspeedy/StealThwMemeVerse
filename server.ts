import express from 'express';
import http from 'http';
import path from 'path';
import { Server as SocketIOServer } from 'socket.io';
import { MemeverseGameServer } from './src/server/gameServer.ts';

async function startServer() {
  const app = express();
  app.use(express.json());

  const httpServer = http.createServer(app);
  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
    transports: ['websocket', 'polling'],
  });

  const gameServer = new MemeverseGameServer(io);

  // REST endpoints for health checks & leaderboard snapshots
  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, game: 'Steal the Memeverse', serverTime: Date.now() });
  });

  app.get('/api/leaderboard', (_req, res) => {
    res.json({ leaderboard: gameServer.getLeaderboard() });
  });

  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR !== 'true',
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  const PORT = Number(process.env.PORT || 3000);
  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`[Memeverse] Server listening on http://0.0.0.0:${PORT}`);
  });

  const shutdown = () => {
    gameServer.destroy();
    httpServer.close(() => process.exit(0));
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

startServer().catch((err) => {
  console.error('[Memeverse] Fatal startup error:', err);
  process.exit(1);
});
