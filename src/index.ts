import express from 'express';
import cors from 'cors';
import session from 'express-session';
import passport from 'passport';
import dotenv from 'dotenv';
import dns from 'dns';
import pg from 'pg';
import pgSession from 'connect-pg-simple';
import type {} from './types/session';

dns.setServers(['1.1.1.1', '1.0.0.1']);
dns.setDefaultResultOrder('ipv4first');

dotenv.config();

import { configurePassport } from './configs/passport';
import { updateServerInfo } from './configs/serverCache';
import authRoutes from './routes/authRoutes';
import storeRoutes from './routes/storeRoutes';
import serverRoutes from './routes/serverRoutes';
import skinsRouter from './routes/skinsRoutes';
import webhookController from './controllers/webhookController';

import { startCronJobs } from './jobs/vipStatus';


const app = express();
const PORT = Number(process.env.PORT) || 3000;
const pgPool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

const PostgresStore = pgSession(session);
app.set('trust proxy', 1);

// ── Middlewares ──────────────────────────────────────────────────────────────

app.use(cors({
    origin: function (origin, callback) {
        if (!origin) return callback(null, true);
        
  

        const allowedOrigins = [
            `${process.env.FRONTEND_URL}` as string,
        ];
              console.log('Origin recebida:', origin);
console.log('Allowed:', allowedOrigins);

        if (allowedOrigins.indexOf(origin) !== -1 || !origin) {
            callback(null, true);
        } else {
            callback(new Error('Não permitido por CORS'));
        }
    },
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization']
}));


app.use(express.json({
  verify: (req: any, res, buf) => {
    req.rawBody = buf;
  }
}));

const isProduction = process.env.NODE_ENV === 'production';

app.use(
  session({
    store: new PostgresStore({
      pool: pgPool,
      tableName: 'session',
    }),
    secret: process.env.SESSION_SECRET as string,
    resave: false,
    saveUninitialized: true,
    cookie: { 
      secure: isProduction, 
      sameSite: isProduction ? 'none' : 'lax', 
      httpOnly: true,
      maxAge: 1000 * 60 * 60 * 24 * 7 
    }, 
  })
);

app.use(passport.initialize());
app.use(passport.session());

app.use((req, _res, next) => {
  if (req.isAuthenticated()) {
    console.log('Autenticado via cookie');
    return next();
  }

  const authHeader = req.headers['authorization'];
  if (!authHeader?.startsWith('Bearer ')) return next();

  const sessionId = authHeader.slice(7);
  console.log('Tentando autenticar via header, sessionId:', sessionId);

  req.sessionStore.get(sessionId, (err, sessionData) => {
    if (err || !sessionData) return next();

    req.sessionID = sessionId;
    req.session.id = sessionId;
    Object.assign(req.session, sessionData);

    if (sessionData.passport?.user) {
      req.user = sessionData.passport.user;
      
      (req as any).isAuthenticated = () => true;
    }

    next();
  });
});


// ── Passport Config ──────────────────────────────────────────────────────────

configurePassport();

// ── Routes ───────────────────────────────────────────────────────────────────

app.use('/api/auth', authRoutes);
app.use('/api/store', storeRoutes);
app.use('/api/server-info', serverRoutes);
app.use('/api/webhooks', webhookController);
app.use('/api/skins', skinsRouter);

// ── Start Server ─────────────────────────────────────────────────────────────

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Servidor rodando na porta ${PORT}`);

  updateServerInfo();
  startCronJobs();
  setInterval(updateServerInfo, 30_000);
});
