import express from 'express';
import path from 'path';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import jwt from 'jsonwebtoken';
import { createServer as createViteServer } from 'vite';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import pool from './db/connection.js';
import { initDB } from './db/init-db.js';
import apiRoutes from './routes/index.js';
import { errorHandler } from './middlewares/error-handler.js';
import { env } from './config/env.js';
import { EmailListenerService } from './services/email-listener.service.js';
import { runTicketAutomations } from './jobs/ticketAutomationJob.js';
import { runWhatsAppInactivityJob } from './jobs/whatsappInactivityJob.js';
import { emailOutboxService } from './services/email-outbox.service.js';
import { setRealtimeServer } from './realtime.js';

export let io: SocketIOServer;

function getCookieValue(cookieHeader: string | undefined, name: string): string | null {
  if (!cookieHeader) return null;
  const parts = cookieHeader.split(';');
  for (const part of parts) {
    const [rawKey, ...rawValue] = part.trim().split('=');
    if (rawKey === name) {
      return decodeURIComponent(rawValue.join('='));
    }
  }
  return null;
}

function getSocketToken(socket: any): string | null {
  const authToken = socket.handshake.auth?.token;
  if (typeof authToken === 'string' && authToken.trim()) return authToken.trim();

  const authorization = socket.handshake.headers?.authorization;
  if (typeof authorization === 'string' && authorization.startsWith('Bearer ')) {
    return authorization.slice('Bearer '.length).trim();
  }

  return getCookieValue(socket.handshake.headers?.cookie, 'token');
}

function getRequestedSocketCompanyId(socket: any): number | null {
  const rawEmpresaId = socket.handshake.auth?.empresa_id || socket.handshake.query?.empresa_id;
  const empresaId = Number(Array.isArray(rawEmpresaId) ? rawEmpresaId[0] : rawEmpresaId);
  return Number.isInteger(empresaId) && empresaId > 0 ? empresaId : null;
}

async function startServer() {
  const productionOrigins = [
    'https://gestifique.com.br',
    'https://www.gestifique.com.br',
    ...env.CORS_ORIGINS,
  ];
  const developmentOrigins = [
    'http://localhost:5173',
    'http://localhost:3000',
    `http://localhost:${env.PORT}`,
    `http://127.0.0.1:${env.PORT}`,
  ];
  const allowedOrigins = [...new Set(env.IS_PROD ? productionOrigins : [...productionOrigins, ...developmentOrigins])];

  const corsOptions = {
    origin: function (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) {
      if (!origin) return callback(null, true);

      const isLocal = !env.IS_PROD && (
        origin.startsWith('http://localhost') ||
        origin.startsWith('http://127.0.0.1')
      );

      if (isLocal || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        console.warn(`[CORS] Blocked request from unauthorized origin: ${origin}`);
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
    exposedHeaders: ['set-cookie']
  };

  const app = express();

  if (env.TRUST_PROXY !== false) {
    app.set('trust proxy', env.TRUST_PROXY);
    console.log(`[BOOT] Trust Proxy configured as: ${env.TRUST_PROXY}`);
  }

  const developmentConnectSources = env.IS_PROD ? [] : ["https://*.run.app", "https://*.studio"];
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: [
          "'self'",
          ...(env.IS_PROD ? [] : ["'unsafe-inline'", "'unsafe-eval'"]),
          "https://cdn.jsdelivr.net"
        ],
        styleSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
        fontSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "blob:", "https://images.unsplash.com", "https://res.cloudinary.com"],
        connectSrc: ["'self'", "ws:", "wss:", ...developmentConnectSources, ...env.CORS_ORIGINS],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        frameAncestors: ["'self'"],
        upgradeInsecureRequests: env.IS_PROD ? [] : null,
      },
    },
    crossOriginResourcePolicy: { policy: "cross-origin" },
    crossOriginEmbedderPolicy: false
  }));

  const globalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 1000,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: 'Too many requests, please try again later.' },
    skip: (req) => !env.IS_PROD || req.path.startsWith('/health')
  });
  app.use(globalLimiter);

  const httpServer = createServer(app);

  if (env.ENABLE_WEB_SERVER) {
    io = new SocketIOServer(httpServer, {
      cors: corsOptions
    });
    setRealtimeServer(io);

    app.set('io', io);

    io.use(async (socket, next) => {
      try {
        const token = getSocketToken(socket);
        const empresaId = getRequestedSocketCompanyId(socket);

        if (!token || !empresaId) {
          return next(new Error('Unauthorized socket connection'));
        }

        const decoded = jwt.verify(token, env.JWT_SECRET) as any;
        if (!decoded?.id) {
          return next(new Error('Unauthorized socket connection'));
        }

        const [rows]: any = await pool.query(
          'SELECT id, empresa_id, administrador, desenvolvedor, ativo, perfil FROM usuarios WHERE id = ?',
          [decoded.id]
        );

        const user = rows[0];
        if (!user || Number(user.ativo) !== 1) {
          return next(new Error('Unauthorized socket connection'));
        }

        const isDeveloper = Boolean(user.desenvolvedor) || user.perfil === 'desenvolvedor';
        if (!isDeveloper && Number(user.empresa_id) !== empresaId) {
          return next(new Error('Forbidden socket room'));
        }

        socket.data.user = {
          id: user.id,
          empresa_id: user.empresa_id,
          administrador: Boolean(user.administrador),
          desenvolvedor: isDeveloper,
          perfil: user.perfil
        };
        socket.data.empresaId = empresaId;
        next();
      } catch {
        next(new Error('Unauthorized socket connection'));
      }
    });

    io.on('connection', (socket) => {
      const empresaId = socket.data.empresaId;
      const room = `empresa_${empresaId}`;
      socket.join(room);
      console.log(`[Socket] User ${socket.data.user?.id} connected to room: ${room}`);

      socket.on('disconnect', () => {
        console.log('[Socket] User disconnected');
      });
    });
  }

  const PORT = env.PORT;

  app.use(cors(corsOptions as cors.CorsOptions));
  app.use(express.json({
    limit: '1mb',
    verify: (req, _res, buf) => {
      (req as any).rawBody = buf;
    },
  }));
  app.use(cookieParser());

  try {
    console.log('[BOOT] Initializing database...');
    await initDB();

    if (process.env.AUTO_SYNC_PERMISSIONS !== 'false') {
      try {
        const { permissionsService } = await import('./services/permissions.service.js');
        console.log('[BOOT] Auto-synchronizing permissions catalog...');
        await permissionsService.syncCatalog();
        console.log('[BOOT] Permissions catalog synchronized.');
      } catch (err) {
        console.error('[BOOT] ⚠️ Erro ao sincronizar catálogo de permissões:', err);
      }
    }
  } catch (err) {
    console.error('❌ CRITICAL: Database initialization failed.');
    if (env.IS_PROD) {
      console.error('Stopping server due to database failure in production.');
      process.exit(1);
    }
  }

  // Healthchecks publicos deliberadamente minimais: nao exponha topologia/servicos.
  app.get('/health', (_req, res) => {
    res.json({ success: true, status: 'UP' });
  });

  app.get('/ready', async (_req, res) => {
    try {
      await pool.query('SELECT 1');
      return res.status(200).json({ success: true, status: 'READY' });
    } catch {
      return res.status(503).json({ success: false, status: 'NOT_READY' });
    }
  });

  if (env.ENABLE_WEB_SERVER) {
    app.use('/api', apiRoutes);

    app.use('/api', (_req, res) => {
      return res.status(404).json({
        success: false,
        message: 'Rota da API não encontrada.',
        data: null,
      });
    });

    // Em producao o servidor nunca inicializa Vite/HMR, mesmo se server.ts for executado por engano.
    const useViteDevMiddleware = !env.IS_PROD;

    if (useViteDevMiddleware) {
      const vite = await createViteServer({
        server: {
          middlewareMode: true,
          hmr: { server: httpServer },
        },
        appType: 'spa',
      });
      app.use(vite.middlewares);
      console.log('[BOOT] Vite middleware ativo (development).');
    } else {
      const distPath = path.join(process.cwd(), 'dist');
      app.use(express.static(distPath));
      app.get('*', (req: express.Request, res: express.Response) => {
        if (req.path.startsWith('/api')) {
          return res.status(404).json({ success: false, message: 'Rota API não encontrada' });
        }
        res.sendFile(path.join(distPath, 'index.html'));
      });
      console.log('[BOOT] Servindo frontend estático de /dist');
    }
  } else {
    app.get('/', (_req, res) => res.status(503).send('Worker Node: HTTP server role disabled.'));
  }

  app.use(errorHandler);

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Gestifique Server Instance running on port ${PORT}`);
    console.log(`Environment: ${env.NODE_ENV}`);
    console.log(`Roles: [WEB: ${env.ENABLE_WEB_SERVER}] [EMAIL_LISTENER: ${env.ENABLE_EMAIL_LISTENER}] [JOBS: ${env.ENABLE_TICKET_JOBS}]`);

    if (env.ENABLE_WEB_SERVER && env.ENABLE_TICKET_JOBS) {
      console.warn('[BOOT] ⚠️ ENABLE_WEB_SERVER=true e ENABLE_TICKET_JOBS=true na mesma instância. Em produção multi-instância, prefira rodar os jobs apenas em um worker.');
    }
    if (env.ENABLE_WEB_SERVER && env.ENABLE_EMAIL_LISTENER) {
      console.warn('[BOOT] ⚠️ ENABLE_WEB_SERVER=true e ENABLE_EMAIL_LISTENER=true na mesma instância. O e-mail listener deve rodar em um worker único.');
    }

    if (env.ENABLE_EMAIL_LISTENER) {
      console.log('[BOOT] Starting Email Listener Service...');
      EmailListenerService.init();
    }

    if (env.ENABLE_TICKET_JOBS) {
      console.log('[BOOT] Starting Ticket Automation Jobs...');
      setInterval(() => {
        runTicketAutomations().catch(err => console.error('[JOB ERROR] runTicketAutomations:', err));
      }, 5 * 60 * 1000);

      setInterval(() => {
        emailOutboxService.processPending().catch(err => console.error('[JOB ERROR] processEmailOutbox:', err));
      }, 60 * 1000);

      setInterval(() => {
        runWhatsAppInactivityJob().catch(err => console.error('[JOB ERROR] whatsappInactivity:', err));
      }, 60 * 1000);

      setTimeout(() => {
        runTicketAutomations().catch(err => console.error('[JOB ERROR INITIAL] runTicketAutomations:', err));
        emailOutboxService.processPending().catch(err => console.error('[JOB ERROR INITIAL] processEmailOutbox:', err));
        runWhatsAppInactivityJob().catch(err => console.error('[JOB ERROR INITIAL] whatsappInactivity:', err));
      }, 5000);
    }
  });
}

startServer().catch(err => {
  console.error('❌ FATAL ERROR during server startup:', err);
  process.exit(1);
});
