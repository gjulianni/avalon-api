import { Request, Response } from 'express';
import { SteamUser } from '../types';

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

export const steamReturn = (_req: Request, res: Response): void => {
  res.redirect(`${process.env.FRONTEND_URL}`);
};
