import { Request, Response } from 'express';
import { prisma } from '../database/index';
import { weaponNameToIndex } from '../helpers/weaponDictionary';

export const equipWeaponStickers = async (req: Request, res: Response) => {
  let steamIdString: string;


  const isServerRequest = req.headers['x-server-api-key'] === process.env.SERVER_API_KEY;

  if (isServerRequest) {
    if (!req.body.steamId) {
      return res.status(400).json({ error: "steamId é obrigatório para requisições do servidor." });
    }
    steamIdString = String(req.body.steamId);
  } else {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const steamUser = req.user as any;
    const accountId = BigInt(steamUser.id) - BigInt('76561197960265728');
    const y = accountId % 2n;
    const z = accountId / 2n;
    steamIdString = `STEAM_1:${y}:${z}`;
  }

  const vipRecord = await prisma.vipOrder.findFirst({
      where: {
        steamId: steamIdString,
        status: 'ACTIVE'
      }
    });

    if (!vipRecord) {
      return res.status(403).json({ 
        success: false, 
        message: "Acesso negado: Este recurso é exclusivo para membros VIP." 
      });
    }

  let { weaponName, slot0, slot1, slot2, slot3, slot4, slot5, wear0, wear1, wear2, wear3, wear4, wear5 } = req.body;

  if (!weaponName) {
    return res.status(400).json({ error: "O nome da arma é obrigatório." });
  }

  weaponName = String(weaponName);
  if (weaponName.startsWith('weapon_')) {
    weaponName = weaponName.replace('weapon_', '');
  }

  const weaponIndex = weaponNameToIndex[weaponName];

  if (weaponIndex === undefined) {
    return res.status(400).json({ error: "Arma inválida ou arma não suporta adesivos." });
  }

  try {
    const stickers = await prisma.playerWeaponStickers.upsert({
      where: {
        steamId_weaponIndex: { 
          steamId: steamIdString,
          weaponIndex: weaponIndex,
        }
      },
      update: {
        slot0: slot0 !== undefined ? Number(slot0) : undefined,
        slot1: slot1 !== undefined ? Number(slot1) : undefined,
        slot2: slot2 !== undefined ? Number(slot2) : undefined,
        slot3: slot3 !== undefined ? Number(slot3) : undefined,
        slot4: slot4 !== undefined ? Number(slot4) : undefined,
        slot5: slot5 !== undefined ? Number(slot5) : undefined,
        wear0: wear0 !== undefined ? Number(wear0) : undefined,
        wear1: wear1 !== undefined ? Number(wear1) : undefined,
        wear2: wear2 !== undefined ? Number(wear2) : undefined,
        wear3: wear3 !== undefined ? Number(wear3) : undefined,
        wear4: wear4 !== undefined ? Number(wear4) : undefined,
        wear5: wear5 !== undefined ? Number(wear5) : undefined,
        lastSeen: Math.floor(Date.now() / 1000), 
      },
      create: {
        steamId: steamIdString,
        weaponIndex: weaponIndex,
        slot0: Number(slot0) || 0,
        slot1: Number(slot1) || 0,
        slot2: Number(slot2) || 0,
        slot3: Number(slot3) || 0,
        slot4: Number(slot4) || 0,
        slot5: Number(slot5) || 0,
        wear0: Number(wear0) || 0.0,
        wear1: Number(wear1) || 0.0,
        wear2: Number(wear2) || 0.0,
        wear3: Number(wear3) || 0.0,
        wear4: Number(wear4) || 0.0,
        wear5: Number(wear5) || 0.0,
        lastSeen: Math.floor(Date.now() / 1000),
      }
    });

    res.json({ success: true, stickers });
  } catch (error) {
    console.error("Erro ao equipar stickers:", error);
    res.status(500).json({ error: "Erro interno no servidor" });
  }
};