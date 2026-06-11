import { Request, Response } from 'express';
import { prisma } from '../database/index';

// Usamos o mesmo dicionário de defindexes do controller de skins
const weaponDefindexes: Record<string, number> = {
  'desert_eagle': 1, 'duals': 2, 'five_seven': 3, 'glock': 4,
  'ak47': 7, 'aug': 8, 'awp': 9, 'famas': 10, 'g3sg1': 11,
  'galil': 13, 'm249': 14, 'm4a4': 16, 'mac10': 17, 'p90': 19,
  'mp5sd': 23, 'ump45': 24, 'xm1014': 25, 'bizon': 26, 'mag7': 27,
  'negev': 28, 'sawedoff': 29, 'tec9': 30, 'zeus': 31, 'p2000': 32,
  'mp7': 33, 'mp9': 34, 'nova': 35, 'p250': 36, 'scar20': 38,
  'sg556': 39, 'ssg08': 40, 'm4a1_silencer': 60, 'usp_silencer': 61,
  'cz75a': 63, 'revolver': 64
};

// Transforma os dados do React na string que o plugin do Nereziel exige
// Formato esperado: "id;schema;x;y;wear;scale;rotation"
const formatSticker = (id: any, wear: any) => {
  const parsedId = Number(id) || 0;
  if (parsedId === 0) return "0;0;0;0;0;0;0";
  
  const parsedWear = Number(wear) || 0.0;
  // Mantemos x, y, rotation em 0 e scale em 1 (padrão)
  return `${parsedId};0;0;0;${parsedWear};1;0`;
};

export const equipWeaponStickers = async (req: Request, res: Response) => {
  let steamId64: string; // Para o banco de skins (CS2)
  let steamId3: string;  // Para checagem VIP (CS:GO Legacy)

  const isServerRequest = req.headers['x-server-api-key'] === process.env.SERVER_API_KEY;

  if (isServerRequest) {
    if (!req.body.steamId) {
      return res.status(400).json({ error: "steamId é obrigatório para requisições do servidor." });
    }
    steamId64 = String(req.body.steamId);
    steamId3 = steamId64; // Fallback caso o servidor mande requisição direta
  } else {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const steamUser = req.user as any;
    steamId64 = String(steamUser.id);
    
    // Cálculo do formato STEAM_1:Y:Z apenas para consultar a tabela VipOrder
    const accountId = BigInt(steamUser.id) - BigInt('76561197960265728');
    const y = accountId % 2n;
    const z = accountId / 2n;
    steamId3 = `STEAM_1:${y}:${z}`;
  }

  // Mantém a trava de segurança VIP!
  const vipRecord = await prisma.vipOrder.findFirst({
    where: {
      steamId: steamId3,
      status: 'ACTIVE'
    }
  });

  if (!vipRecord) {
    return res.status(403).json({ 
      success: false, 
      message: "Acesso negado: Este recurso é exclusivo para membros VIP." 
    });
  }

  // Recebe os dados. Note que ignoramos slot5/wear5 pois o CS2 suporta no máximo 5 (0 a 4)
  let { weaponName, slot0, slot1, slot2, slot3, slot4, wear0, wear1, wear2, wear3, wear4, team } = req.body;

  if (!weaponName) {
    return res.status(400).json({ error: "O nome da arma é obrigatório." });
  }

  if (!team || (Number(team) !== 2 && Number(team) !== 3)) {
    return res.status(400).json({ error: "Selecione o time para ser exibido o inventário." });
  }

  weaponName = String(weaponName).replace('weapon_', '');

  if (weaponName.startsWith('knife') || weaponName === 'bayonet') {
    return res.status(400).json({ error: "Facas não suportam adesivos." });
  }

  const defindex = weaponDefindexes[weaponName];

  if (!defindex) {
    return res.status(400).json({ error: "Arma inválida ou não suportada." });
  }

  try {
    const stickerData = {
      weapon_sticker_0: formatSticker(slot0, wear0),
      weapon_sticker_1: formatSticker(slot1, wear1),
      weapon_sticker_2: formatSticker(slot2, wear2),
      weapon_sticker_3: formatSticker(slot3, wear3),
      weapon_sticker_4: formatSticker(slot4, wear4),
    };
    
    const teamsToUpdate = team ? [Number(team)] : [2, 3];
    const transactions = teamsToUpdate.map(t => 
      prisma.wpPlayerSkins.upsert({
        where: { steamid_weapon_team_weapon_defindex: { steamid: steamId64, weapon_team: t, weapon_defindex: defindex } },
        update: stickerData,
        create: { steamid: steamId64, weapon_team: t, weapon_defindex: defindex, weapon_paint_id: 0, ...stickerData }
      })
    );

    await prisma.$transaction(transactions);

    res.json({ success: true, message: "Adesivos aplicados com sucesso!" });
  } catch (error) {
    console.error("Erro ao equipar stickers:", error);
    res.status(500).json({ error: "Erro interno no servidor" });
  }
};