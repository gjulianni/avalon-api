import { vipGroupMap } from "../controllers/webhookController";
import { prisma } from "../database";
import executeRconAction from "../controllers/avalonStore/helpers/rcon";
import convertSteam2ToSteam64 from "../controllers/avalonStore/helpers/converters/steam2To64";

export const processApprovedOrder = async (dbOrderId: string, remoteOrder: any) => {
console.log(`\n[DEBUG HELPER] 1. Iniciando processamento para o pedido: ${dbOrderId}`);
  const orderData = remoteOrder.data || remoteOrder;

  const steamId2 = orderData.client_identifier; 
  if (!steamId2) {
    console.error(`[Loja] Erro crítico: client_identifier ausente no pedido ${dbOrderId}. Payload:`, orderData);
    return;
  }

  console.log(`[DEBUG HELPER] 2. SteamID2: ${steamId2} | Tem pacotes? ${!!orderData.packages}`);
  const steamId64 = convertSteam2ToSteam64(steamId2);
  console.log(`[DEBUG HELPER] 3. SteamID64: ${steamId64}`);
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
  console.log(`[DEBUG HELPER] 4. Fazendo Upsert na tabela Order...`);

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

  console.log(`[DEBUG HELPER] 5. Criando registro na tabela VipOrder...`);
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
    console.log(`[DEBUG HELPER] 6. Atualizando cs2-store (Vip: true)...`);
    await prisma.storePlayers.updateMany({
      
      where: { SteamID: steamIdBigInt },
      data: { Vip: true } 
    });

    const rconCommand = `css_vip_adduser ${steamId64} ${targetGroup} ${totalDays}`;
    console.log(`[DEBUG HELPER] 7. Disparando RCON: ${rconCommand}`);
    await executeRconAction(steamId64, 'raw', rconCommand);
    console.log(`[DEBUG HELPER] 8. FINALIZADO COM SUCESSO!`); 

    console.log(`[Loja] Sucesso! Pedido ${dbOrderId} processado. VIP de ${totalDays} dias gerado para o ID ${steamId64} (Grupo: ${targetGroup}).`);
  } catch (error) {
    console.error(`[Loja] Falha crítica ao tentar sincronizar VIP in-game para ${steamId64}:`, error);
  }
};