import { vipGroupMap } from "../controllers/webhookController";
import { prisma } from "../database";
import executeRconAction from "../controllers/avalonStore/helpers/rcon";
import convertSteam2ToSteam64 from "../controllers/avalonStore/helpers/converters/steam2To64";

export const processApprovedOrder = async (dbOrderId: string, remoteOrder: any) => {

  const orderData = remoteOrder.data || remoteOrder;

  const steamId2 = orderData.client_identifier; 
  if (!steamId2) {
    console.error(`[Loja] Erro crítico: client_identifier ausente no pedido ${dbOrderId}. Payload:`, orderData);
    return;
  }
  
  const steamId64 = convertSteam2ToSteam64(steamId2);
  const steamIdBigInt = BigInt(steamId64);

  let totalDays = 0;
  let targetGroup = 'vip1';

  if (orderData.packages && orderData.packages.length > 0) {
    orderData.packages.forEach((pkg: any) => {
      const daysPerPackage = pkg.meta?.expiry_days || 30; 
      const qty = pkg.quantity || 1;
      totalDays += (daysPerPackage * qty);

      const pkgId = Number(pkg.package_id);
      if (vipGroupMap[pkgId]) {
        targetGroup = vipGroupMap[pkgId];
      }
    });
  } else {
    totalDays = 30;
  }

  await prisma.order.upsert({
    where: { id: dbOrderId },
    update: { status: 'APPROVED' },
    create: {
      id: dbOrderId,
      status: 'APPROVED',
      userId: steamId2 
    }
  });

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + totalDays);

  await prisma.vipOrder.create({
    data: {
      steamId: steamId2,
      vipGroup: targetGroup,
      status: "ACTIVE",
      durationDays: totalDays, 
      expiresAt: expiresAt,
      notifiedAdd: true, 
      notifiedDel: false
    }
  });


  try {
    await prisma.storePlayers.updateMany({
      where: { SteamID: steamIdBigInt },
      data: { Vip: true } 
    });

    const rconCommand = `css_vip_adduser ${steamId64} ${targetGroup} ${totalDays}`;

    await executeRconAction(steamId64, 'raw', rconCommand); 

    console.log(`[Loja] Sucesso! Pedido ${dbOrderId} processado. VIP de ${totalDays} dias gerado para o ID ${steamId64} (Grupo: ${targetGroup}).`);
  } catch (error) {
    console.error(`[Loja] Falha crítica ao tentar sincronizar VIP in-game para ${steamId64}:`, error);
  }
};