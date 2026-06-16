import { Request, Response } from 'express';
import { prisma } from '../../database/index';
import findItemByUniqueId from './helpers/findByUniqueId';
import executeRconAction from './helpers/rcon';
import convertSteamID from '../../helpers/convertSteamID';

export let globalStoreCatalog: any = null;

export const syncCatalog = async (req: Request, res: Response) => {

  const authHeader = req.headers['authorization'];
  if (authHeader !== `Bearer ${process.env.STORE_SYNC_SECRET}`) {
    return res.status(401).json({ error: 'Acesso negado. Token inválido.' });
  }

  try {
    const rawCatalog = req.body;
    
    if (!rawCatalog || !rawCatalog.Items) {
      return res.status(400).json({ error: 'Formato de catálogo inválido ou sem a chave Items.' });
    }

    globalStoreCatalog = rawCatalog;
    console.log(`[Store] Catálogo sincronizado com sucesso do Servidor CS2!`);
    
    return res.status(200).json({ success: true, message: 'Catálogo sincronizado.' });
  } catch (error) {
    console.error("Erro ao sincronizar catálogo:", error);
    return res.status(500).json({ error: 'Erro interno no servidor.' });
  }
};

export const getCatalog = async (req: Request, res: Response) => {
  if (!globalStoreCatalog) {
    return res.status(404).json({ error: 'Catálogo ainda não foi sincronizado pelo servidor.' });
  }
  return res.status(200).json({ success: true, catalog: globalStoreCatalog });
};

export const getPlayerStoreData = async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const steamIdStr = String((req.user as any).id);
  const steamIdBigInt = BigInt((req.user as any).id);

  const converted = convertSteamID(steamIdStr);

  try {
 
    const playerRecord = await prisma.storePlayers.findUnique({
      where: { SteamID: steamIdBigInt }
    });
    const vipRecord = await prisma.vipOrder.findFirst({
      where: { steamId: converted },
      orderBy: { expiresAt: 'desc' }
    });

    let credits = playerRecord?.Credits || 0;
    
    const isStoreVip = !!vipRecord;
    const lastSession = playerRecord?.DateOfLastJoin || new Date(0);

   const rconResponse = await executeRconAction(steamIdStr, 'credits' as any, 'none');
    console.log(`Resposta crua do RCON: "${rconResponse}"`);

    const matchRegex = new RegExp(`AVALON_CREDITS_${steamIdStr}:(\\d+)`);
    const match = rconResponse.match(matchRegex);
    
    if (match && match[1]) {
      const liveCredits = parseInt(match[1]);
      if (!isNaN(liveCredits)) {
        credits = liveCredits; 
        console.log(`Regex encontrou AVALON_CREDITS! Substituindo saldo para a RAM: ${credits}`);
      }
    } else {
      console.log(`Regex FALHOU ou RCON vazio. Mantendo saldo do Banco: ${credits}`);
    }
    console.log(`----------------------------\n`);

    const purchases = await prisma.storeItems.findMany({
      where: { SteamID: steamIdBigInt },
      select: { UniqueId: true } 
    });
    const ownedItems = purchases.map(p => p.UniqueId);

    const equipments = await prisma.storeEquipments.findMany({
      where: { SteamID: steamIdBigInt },
      select: { UniqueId: true, Slot: true }
    });
    const equippedItems = equipments.map(e => e.UniqueId);

    return res.status(200).json({
      success: true,
      credits,
      isStoreVip,
      ownedItems,
      equippedItems,
      lastSession
    });
  } catch (error) {
    console.error("Erro ao buscar dados da loja do jogador:", error);
    return res.status(500).json({ error: 'Erro interno no servidor.' });
  }
};

export const buyItem = async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) return res.status(401).json({ error: 'Não autorizado.' });

  const steamIdStr = String((req.user as any).id);
  const steamIdBigInt = BigInt(steamIdStr);
  const { uniqueId } = req.body;

  if (!globalStoreCatalog) return res.status(503).json({ error: 'Loja indisponível no momento.' });

  const itemDef = findItemByUniqueId(globalStoreCatalog.Items, uniqueId);
  if (!itemDef) return res.status(404).json({ error: 'Item não encontrado no catálogo.' });

  const price = parseInt(itemDef.price || '0');
  if (price === 0) return res.status(400).json({ error: 'Itens gratuitos devem ser equipados diretamente.' });

  try {
    const rconResponse = await executeRconAction(steamIdStr, 'buy', uniqueId);

   if (rconResponse.includes(`AVALON_SUCCESS_${steamIdStr}`)) {
      return res.status(200).json({ success: true, message: 'Ao vivo no servidor!' });
    }

    if (rconResponse.includes(`AVALON_ERROR_${steamIdStr}`)) {

      const errorMsg = rconResponse.split(`AVALON_ERROR_${steamIdStr}: `)[1] || 'Erro desconhecido.';
      return res.status(400).json({ error: errorMsg });
    }

    if (rconResponse.includes('AVALON_OFFLINE') || rconResponse === 'RCON_FAILED') {
      const player = await prisma.storePlayers.findUnique({ where: { SteamID: steamIdBigInt } });
      if (!player) return res.status(404).json({ error: 'Conta não encontrada.' });

      if (player.Credits < price) return res.status(400).json({ error: 'Créditos insuficientes no banco de dados.' });

      const alreadyOwns = await prisma.storeItems.findFirst({ where: { SteamID: steamIdBigInt, UniqueId: uniqueId } });
      if (alreadyOwns) return res.status(400).json({ error: 'Você já possui este item.' });

      await prisma.$transaction([
        prisma.storePlayers.update({ where: { SteamID: steamIdBigInt }, data: { Credits: { decrement: price } } }),
        prisma.storeItems.create({
          data: {
            SteamID: steamIdBigInt,
            Price: price,
            Type: itemDef.type || 'playerskin',
            UniqueId: uniqueId,
            DateOfPurchase: new Date(),
            DateOfExpiration: new Date('0001-01-01T00:00:00Z')
          }
        })
      ]);

      return res.status(200).json({ success: true, message: 'Compra processada no banco de dados.' });
    }

    return res.status(200).json({ 
      success: true, 
      message: 'Comando enviado! A resposta demorou, atualize a página para confirmar.' 
    });

  } catch (error) {
    console.error("Erro na compra:", error);
    return res.status(500).json({ error: 'Erro interno ao processar a compra.' });
  }
};

export const equipItem = async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) return res.status(401).json({ error: 'Não autorizado.' });

  const steamIdStr = String((req.user as any).id);
  const steamIdBigInt = BigInt(steamIdStr);
  const { uniqueId } = req.body;

  if (!globalStoreCatalog) return res.status(503).json({ error: 'Loja indisponível no momento.' });

  const itemDef = findItemByUniqueId(globalStoreCatalog.Items, uniqueId);
  if (!itemDef) return res.status(404).json({ error: 'Item não encontrado no catálogo.' });

  const price = parseInt(itemDef.price || '0');
  const type = itemDef.type || 'playerskin';
  const slot = parseInt(itemDef.slot || '0');

  try {
    const isVipOnly = itemDef.flag?.includes('@css/reservation');
    if (isVipOnly) {
      const player = await prisma.storePlayers.findUnique({ where: { SteamID: steamIdBigInt } });
      if (!player || !player.Vip) return res.status(403).json({ error: 'Apenas VIPs podem equipar isto.' });
    }

    if (price > 0) {
      const ownsItem = await prisma.storeItems.findFirst({ where: { SteamID: steamIdBigInt, UniqueId: uniqueId } });
      if (!ownsItem) return res.status(403).json({ error: 'Você precisa comprar este item primeiro.' });
    }

    const rconResponse = await executeRconAction(steamIdStr, 'equip', uniqueId);
    
  if (rconResponse.includes(`AVALON_SUCCESS_${steamIdStr}`)) {
      return res.status(200).json({ success: true, message: 'Ao vivo no servidor!' });
    }

    if (rconResponse.includes(`AVALON_ERROR_${steamIdStr}`)) {
      const errorMsg = rconResponse.split(`AVALON_ERROR_${steamIdStr}: `)[1] || 'Erro desconhecido.';
      return res.status(400).json({ error: errorMsg });
    }

    if (rconResponse.includes('AVALON_OFFLINE') || rconResponse === 'RCON_FAILED') {
      await prisma.$transaction([
        prisma.storeEquipments.deleteMany({
          where: { SteamID: steamIdBigInt, Type: type, Slot: slot }
        }),
        prisma.storeEquipments.create({
          data: { SteamID: steamIdBigInt, Type: type, UniqueId: uniqueId, Slot: slot }
        })
      ]);

      return res.status(200).json({ success: true, message: 'Item equipado para a próxima sessão.' });
    }

    return res.status(200).json({ 
      success: true, 
      message: 'Comando de equipar enviado! Atualize a página para confirmar.' 
    });

  } catch (error) {
    console.error("Erro ao equipar:", error);
    return res.status(500).json({ error: 'Erro interno ao equipar o item.' });
  }
};