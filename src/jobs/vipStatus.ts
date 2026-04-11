import cron from 'node-cron';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const startCronJobs = () => {
  cron.schedule('*/1 * * * *', async () => {
    console.log('[Cron] Verificando VIPs expirados...');
    
    const agora = new Date();

    try {
      const vipsParaExpirar = await prisma.vipOrder.findMany({
        where: {
          status: "ACTIVE",
          expiresAt: {
            lt: agora 
          }
        }
      });

      if (vipsParaExpirar.length > 0) {
        const ids = vipsParaExpirar.map(v => v.id);

        await prisma.vipOrder.updateMany({
          where: {
            id: { in: ids }
          },
          data: {
            status: "EXPIRED"
          }
        });

        console.log(`[Cron] Sucesso: ${vipsParaExpirar.length} VIPs expirados.`);
      }
    } catch (error) {
      console.error('[Cron] Erro ao processar expirações:', error);
    }
  });
};