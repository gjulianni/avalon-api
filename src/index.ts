import express from 'express';
import cors from 'cors';
import session from 'express-session';
import passport from 'passport';
import dotenv from 'dotenv';
import dns from 'dns';
import pg from 'pg';
import pgSession from 'connect-pg-simple';

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
const PORT = process.env.PORT || 3000;
const pgPool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

const PostgresStore = pgSession(session);
app.set('trust proxy', 1);

// ── Middlewares ──────────────────────────────────────────────────────────────

console.log("FRONTEND_URL:", process.env.FRONTEND_URL);

app.use(
  cors({
    origin: (process.env.FRONTEND_URL as string).replace(/\/$/, ""),
    credentials: true,
  })
);

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
    saveUninitialized: false,
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

// ── Passport Config ──────────────────────────────────────────────────────────

configurePassport();

// ── Routes ───────────────────────────────────────────────────────────────────

app.use('/api/auth', authRoutes);
app.use('/api/store', storeRoutes);
app.use('/api/server-info', serverRoutes);
app.use('/api/webhooks', webhookController);
app.use('/api/skins', skinsRouter);

// ── Start Server ─────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);

  updateServerInfo();
  startCronJobs();
  setInterval(updateServerInfo, 30_000);
});
