import { Request, Response } from 'express';
import { serverCache } from '../configs/serverCache';

export const getServerInfo = (_req: Request, res: Response): void => {
  if (!serverCache.serverInfo) {
    res.status(503).json({ error: 'Informações do servidor ainda não estão disponíveis.' });
    return;
  }
  res.json(serverCache);
};
