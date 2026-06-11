import { Request, Response } from 'express';
import { prisma } from '../database';

const weaponDefindexes: Record<string, number> = {
  // Pistols
  'desert_eagle': 1, 'duals': 2, 'five_seven': 3, 'glock': 4,
  'tec9': 30, 'p2000': 32, 'p250': 36, 'usp_silencer': 61, 'cz75a': 63, 'revolver': 64,
  // Rifles
  'ak47': 7, 'aug': 8, 'awp': 9, 'famas': 10, 'g3sg1': 11,
  'galil': 13, 'm4a4': 16, 'scar20': 38, 'sg556': 39, 'ssg08': 40, 'm4a1_silencer': 60,
  // SMGs
  'mac10': 17, 'p90': 19, 'mp5sd': 23, 'ump45': 24, 'bizon': 26, 'mp7': 33, 'mp9': 34,
  // Heavy
  'm249': 14, 'xm1014': 25, 'mag7': 27, 'negev': 28, 'sawedoff': 29, 'nova': 35,
  // Equipment
  'zeus': 31,
  // Facas CS2
  'bayonet': 500,
  'knife_css': 503,
  'knife_flip': 505,
  'knife_gut': 506,
  'knife_karambit': 507,
  'knife_m9_bayonet': 508,
  'knife_tactical': 509,
  'knife_falchion': 512,
  'knife_survival_bowie': 514,
  'knife_butterfly': 515,
  'knife_push': 516,
  'knife_cord': 517,
  'knife_canis': 518,
  'knife_ursus': 519,
  'knife_gypsy_jackknife': 520,
  'knife_outdoor': 521,
  'knife_stiletto': 522,
  'knife_widowmaker': 523,
  'knife_skeleton': 525,
  'knife_kukri': 526,
};

export const equipWeaponSkin = async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const steamUser = req.user as any;
  const steamIdString = String(steamUser.id);

  // Agora recebemos o parâmetro 'team' do Front-End (2 = TR, 3 = CT)
  let { weaponName, paintKit, wearFloat, statTrak, statTrakCount, nameTag, seed, team } = req.body;

  if (!weaponName) {
    return res.status(400).json({ error: "O nome da arma é obrigatório." });
  }

  if (!team || (Number(team) !== 2 && Number(team) !== 3)) {
    return res.status(400).json({ error: "Selecione o time para ser exibido o inventário." });
  }

  const t = Number(team);

  const baseWeaponName = String(weaponName).replace('weapon_', '');
  const defindex = weaponDefindexes[baseWeaponName];
  
  if (!defindex) {
    return res.status(400).json({ error: `Arma não suportada: ${baseWeaponName}` });
  }

  const isKnife = baseWeaponName.startsWith('knife') || baseWeaponName === 'bayonet';

  try {
    const skinData = {
      weapon_paint_id: Number(paintKit) || 0,
      weapon_wear: Number(wearFloat) || 0.0001,
      weapon_seed: Number(seed) || 0,
      weapon_stattrak: Boolean(statTrak),
      weapon_stattrak_count: Number(statTrakCount) || 0,
      weapon_nametag: nameTag || null,
    };

    const transactions: any[] = [];

    // 🚨 AGORA ELE SÓ FAZ UPSERT NO TIME ESPECÍFICO (t)
    transactions.push(
      prisma.wpPlayerSkins.upsert({
        where: { steamid_weapon_team_weapon_defindex: { steamid: steamIdString, weapon_team: t, weapon_defindex: defindex } },
        update: skinData,
        create: { steamid: steamIdString, weapon_team: t, weapon_defindex: defindex, ...skinData }
      })
    );

    if (isKnife) {
      const knifeDbString = `weapon_${baseWeaponName}`;
      transactions.push(
        prisma.wpPlayerKnife.upsert({
          where: { steamid_weapon_team: { steamid: steamIdString, weapon_team: t } },
          update: { knife: knifeDbString },
          create: { steamid: steamIdString, weapon_team: t, knife: knifeDbString }
        })
      );
    }

    await prisma.$transaction(transactions);
    res.json({ success: true, message: isKnife ? "Faca equipada com sucesso!" : "Skin equipada com sucesso!" });
  } catch (error) {
    console.error("Erro ao equipar skin:", error);
    res.status(500).json({ error: "Erro interno no servidor" });
  }
};

export const getPlayerInventory = async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) return res.status(401).json({ error: 'Unauthorized' });

  const steamIdString = String((req.user as any).id);

  try {
    // Busca as skins de AMBOS os times agora (sem o where: { weapon_team: 2 })
    const inventoryRaw = await prisma.wpPlayerSkins.findMany({ where: { steamid: steamIdString } });
    const knivesRaw = await prisma.wpPlayerKnife.findMany({ where: { steamid: steamIdString } });

    // Mapeia qual faca está ativa para TR (2) e CT (3)
    const activeKnives: Record<number, string> = {};
    knivesRaw.forEach(k => { activeKnives[k.weapon_team] = k.knife; });

    const reverseDefindexes = Object.fromEntries(Object.entries(weaponDefindexes).map(([k, v]) => [v, k]));

    const formattedInventory = inventoryRaw.map(item => {
      const wName = reverseDefindexes[item.weapon_defindex] || `unknown_${item.weapon_defindex}`;
      const isKnife = wName.startsWith('knife') || wName === 'bayonet';
      const expectedDbName = `weapon_${wName}`;

      return {
        weaponName: wName,
        team: item.weapon_team,
        paintKit: item.weapon_paint_id,
        wearFloat: item.weapon_wear,
        seed: item.weapon_seed,
        statTrak: item.weapon_stattrak,
        statTrakCount: item.weapon_stattrak_count,
        nameTag: item.weapon_nametag,
        isEquipped: isKnife ? (expectedDbName === activeKnives[item.weapon_team]) : undefined,
        sticker_0: item.weapon_sticker_0,
        sticker_1: item.weapon_sticker_1,
        sticker_2: item.weapon_sticker_2,
        sticker_3: item.weapon_sticker_3,
        sticker_4: item.weapon_sticker_4,
      };
    });

    return res.status(200).json({ success: true, inventory: formattedInventory, stickers: [] });
  } catch (error) {
    console.error("Erro ao buscar inventário:", error);
    return res.status(500).json({ success: false, message: "Erro interno no servidor." });
  }
};