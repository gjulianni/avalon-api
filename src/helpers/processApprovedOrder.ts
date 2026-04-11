import { vipGroupMap } from "../controllers/webhookController";
import { prisma } from "../database";

export const processApprovedOrder = async (dbOrderId: string, remoteOrder: any) => {
  const steamId = remoteOrder.client_identifier;

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
      steamId: steamId,
      vipGroup: targetGroup,
      status: "ACTIVE",
      durationDays: totalDays, 
      expiresAt: expiresAt,
      notifiedAdd: false,
      notifiedDel: false
    }
  });

  console.log(`[Loja] Pedido ${dbOrderId} aprovado! VIP de ${totalDays} dias gerado para ${steamId}.`);
};