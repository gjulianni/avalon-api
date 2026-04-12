import { Request, Response } from 'express';
import { SteamUser } from '../types';

const pendingTokens = new Map<string, { sessionId: string; expiresAt: number }>();

setInterval(() => {
  const now = Date.now();
  for (const [token, entry] of pendingTokens.entries()) {
    if (now > entry.expiresAt) pendingTokens.delete(token);
  }
}, 60 * 1000);

export const getUser = (req: Request, res: Response): void => {
  if (req.isAuthenticated()) {
    const user = req.user as SteamUser;
    res.json({
      loggedIn: true,
      user: {
        steamid: user.id,
        name: user.displayName,
        avatar: user.photos?.[2]?.value || user.photos?.[0]?.value || '',
      },
    });
  } else {
    res.json({ loggedIn: false });
  }
};

export const logout = (req: Request, res: Response): void => {
  req.logout((err) => {
    if (err) {
      res.status(500).json({ error: 'Failed to logout' });
      return;
    }

    req.session.destroy((err) => {
      if (err) {
        res.status(500).json({ error: 'Failed to destroy session' });
        return;
      }
      res.clearCookie('connect.sid');
      res.json({ success: true, message: 'Logged out successfully' });
    });
  });
};

export const steamReturn = (req: Request, res: Response): void => {
  req.session.save((err) => {
    if (err) {
      console.error('Erro ao salvar sessão:', err);
      res.redirect(`${process.env.FRONTEND_URL}?error=auth_failed`);
      return;
    }

    const token = crypto.randomUUID();
    
    pendingTokens.set(token, {
      sessionId: req.sessionID,
      expiresAt: Date.now() + 5 * 60 * 1000,
    });

    console.log('SessionID salvo no banco:', req.sessionID);
    res.redirect(`${process.env.FRONTEND_URL}/auth/callback?token=${token}`);
  });
};

export const exchangeToken = (req: Request, res: Response): void => {
  const { token } = req.body;

  if (!token || typeof token !== 'string') {
    res.status(400).json({ error: 'Token inválido' });
    return;
  }

  const entry = pendingTokens.get(token);

  if (!entry || Date.now() > entry.expiresAt) {
    pendingTokens.delete(token);
    res.status(401).json({ error: 'Token expirado ou inválido' });
    return;
  }

  pendingTokens.delete(token); 
  res.json({ sessionId: entry.sessionId });
};