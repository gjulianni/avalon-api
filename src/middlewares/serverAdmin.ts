import { Request, Response, NextFunction } from "express";
import { prisma } from "../database";
import { SteamUser } from "../types";

export const checkAdmin = async (req: Request, res: Response, next: NextFunction) => {

   if (!req.isAuthenticated()) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const user = req.user as SteamUser;

  try {
    const isAdmin = await prisma.serverAdmin.findUnique({
      where: { steamId: user.id }
    });

    if (!isAdmin) {
      return res.status(403).json({ success: false, error: 'Acesso negado. Apenas administradores.' });
    }

    next();
  } catch (error) {
    console.error("Erro na verificação de admin:", error);
    return res.status(500).json({ success: false, error: 'Erro interno.' });
  }
};