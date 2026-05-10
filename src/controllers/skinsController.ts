import { Request, Response } from 'express';
import { prisma } from '../database';
import fs from 'fs';
import path from 'path';

const knifeModelIds: Record<string, number> = {
  'knife_karambit': 33,
  'knife_m9_bayonet': 34,
  'bayonet': 35,
  'knife_survival_bowie': 36,
  'knife_butterfly': 37,
  'knife_flip': 38,
  'knife_push': 39, // Shadow Daggers
  'knife_tactical': 40, // Huntsman
  'knife_falchion': 41,
  'knife_gut': 42,
  'knife_ursus': 43,
  'knife_gypsy_jackknife': 44, // Navaja
  'knife_stiletto': 45,
  'knife_widowmaker': 46, // Talon
  'knife_css': 48, // Classic
  'knife_cord': 49, // Paracord
  'knife_canis': 50, // Survival
  'knife_outdoor': 51, // Nomad
  'knife_skeleton': 52,
};


export const equipWeaponSkin = async (req: Request, res: Response) => {
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

  let { weaponName, paintKit, wearFloat, statTrak, statTrakCount, nameTag, seed } = req.body;

  if (!weaponName) {
    return res.status(400).json({ error: "O nome da arma é obrigatório." });
  }

  weaponName = String(weaponName);
  if (weaponName.startsWith('weapon_')) {
    weaponName = weaponName.replace('weapon_', '');
  }

  try {

    const isKnife = weaponName.startsWith('knife') || weaponName === 'bayonet';
    if (isKnife) {
      await prisma.playerWeaponSkin.updateMany({
        where: {
          steamId: steamIdString,
          OR: [
            { weaponName: { startsWith: 'knife' } },
            { weaponName: 'bayonet' }
          ]
        },
        data: { isEquipped: false }
      });
    }

    const skin = await prisma.playerWeaponSkin.upsert({
      where: {
        steamId_weaponName: {
          steamId: steamIdString,
          weaponName: String(weaponName),
        }
      },
      update: {
        paintKit: paintKit !== undefined ? Number(paintKit) : undefined,
        wearFloat: wearFloat !== undefined ? Number(wearFloat) : undefined,
        statTrak: statTrak !== undefined ? Boolean(statTrak) : undefined,
        statTrakCount: statTrakCount !== undefined ? Number(statTrakCount) : undefined,
        nameTag: nameTag !== undefined ? nameTag : undefined,
        seed: seed !== undefined ? Number(seed) : undefined,
        isEquipped: isKnife ? true : undefined,
      },
      create: {
        steamId: steamIdString,
        weaponName: String(weaponName),
        paintKit: Number(paintKit) || 0,
        wearFloat: Number(wearFloat) || 0.0,
        statTrak: Boolean(statTrak),
        statTrakCount: Number(statTrakCount) || 0,
        nameTag: nameTag || "",
        seed: Number(seed) || -1,
        isEquipped: isKnife ? true : false,
      }
    });

    res.json({ success: true, skin });
  } catch (error) {
    console.error("Erro ao equipar skin:", error);
    res.status(500).json({ error: "Erro interno no servidor" });
  }
};


export const syncPlayerSkins = async (req: Request, res: Response) => {
  const { steamId } = req.params; 

  if (!steamId) {
    return res.status(400).json({ success: false, error: 'SteamID ausente' });
  }

  try {
    const parts = steamId.split(':'); 
    
    if (parts.length !== 3 || !parts[0].startsWith('STEAM_')) {
      return res.status(400).json({ success: false, error: 'Formato de SteamID inválido' });
    }

    const y = parts[1]; 
    const z = parts[2]; 

    const possibleSteamIds = [
      `STEAM_0:${y}:${z}`,
      `STEAM_1:${y}:${z}`
    ];
    
    const allSkins = await prisma.playerWeaponSkin.findMany({
      where: { 
        steamId: { in: possibleSteamIds } 
      }
    });

    const activeSkins = allSkins.filter(skin => {
      const isKnife = skin.weaponName.startsWith('knife') || skin.weaponName === 'bayonet';
      
      if (isKnife) {
        return skin.isEquipped === true; 
      }
      
      return true; 
    });

    const finalSkins = activeSkins.map(skin => {
      return {
        steamId: skin.steamId,
        weaponName: skin.weaponName,
        paintKit: skin.paintKit,
        wearFloat: skin.wearFloat === 0 ? 0.0001 : skin.wearFloat,
        seed: skin.seed,
        knifeModelId: skin.weaponName.startsWith('knife') || skin.weaponName === 'bayonet' 
          ? (knifeModelIds[skin.weaponName] || 0) 
          : 0
      };
    });

    return res.status(200).json({ success: true, skins: finalSkins, gloves: [] });
  } catch (error) {
    console.error("Erro no sync individual:", error);
    return res.status(500).json({ success: false });
  }
};

export const getPlayerInventory = async (req: Request, res: Response) => {
    if (!req.isAuthenticated()) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

    const steamUser = req.user as any;

  const accountId = BigInt(steamUser.id) - BigInt('76561197960265728');
  const y = accountId % 2n;
  const z = accountId / 2n;
  const steamIdString = `STEAM_1:${y}:${z}`;

  try {
    const inventory = await prisma.playerWeaponSkin.findMany({
      where: {  steamId: steamIdString },
    });

    return res.status(200).json({
      success: true,
      inventory
    });
  } catch (error) {
    console.error("Erro ao buscar inventário:", error);
    return res.status(500).json({ success: false, message: "Erro interno no servidor." });
  }
};

let cachedValidIds: string[] = [];

export const getValidSkinIds = async (req: Request, res: Response) => {
  try {
    if (cachedValidIds.length > 0) {
      return res.status(200).json({ success: true, data: cachedValidIds });
    }

    console.log("[AVALON] Lendo o arquivo weapons_brazilian.cfg...");

    const cfgPath = path.join(process.cwd(), 'src', 'data', 'weapons_brazilian.cfg');
    

    if (!fs.existsSync(cfgPath)) {
      console.error(`[AVALON] Arquivo não encontrado no caminho: ${cfgPath}`);
      return res.status(500).json({ success: false, error: "Arquivo de configuração não encontrado no servidor." });
    }

    const fileContent = fs.readFileSync(cfgPath, 'utf-8');
    const regex = /"index"\s+"(\d+)"/g;
    let match;
    const idsSet = new Set<string>();

    while ((match = regex.exec(fileContent)) !== null) {
      idsSet.add(match[1]);
    }

    cachedValidIds = Array.from(idsSet);
    console.log(`[AVALON] Extraídos ${cachedValidIds.length} IDs válidos.`);

    return res.status(200).json({ success: true, data: cachedValidIds });

  } catch (error) {
    console.error("Erro ao ler o arquivo de skins:", error);
    return res.status(500).json({ success: false, error: "Erro interno ao processar skins" });
  }
};