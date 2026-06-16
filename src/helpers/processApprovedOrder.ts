import { vipGroupMap } from "../controllers/webhookController";
import { prisma } from "../database";
import executeRconAction from "../controllers/avalonStore/helpers/rcon";
import convertSteam2ToSteam64 from "../controllers/avalonStore/helpers/converters/steam2To64";

export const processApprovedOrder = async (dbOrderId: string, remoteOrder: any) => {
  const steamId2 = remoteOrder.client_identifier; 
  const steamId64 = convertSteam2ToSteam64(steamId2);
  const steamIdBigInt = BigInt(steamId64);

  let totalDays = 0;
  let targetGroup = 'vip1';

  if (remoteOrder.packages && remoteOrder.packages.length > 0) {
    remoteOrder.packages.forEach((pkg: any) => {
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

  await prisma.order.update({
    where: { id: dbOrderId },
    data: { status: 'APPROVED' }
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