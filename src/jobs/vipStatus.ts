import cron from 'node-cron';
import { prisma } from '../database/index';
import executeRconAction from '../controllers/avalonStore/helpers/rcon';
import convertSteam2ToSteam64 from '../controllers/avalonStore/helpers/converters/steam2To64';

let isJobRunning = false;

export const startCronJobs = () => {
  cron.schedule('*/1 * * * *', async () => {

    if (isJobRunning) return;
    isJobRunning = true;

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
        for (const vip of vipsParaExpirar) {
          let convertedId = convertSteam2ToSteam64(vip.steamId);
          await executeRconAction(convertedId, 'raw', `css_vip_deleteuser ${convertedId}`);
        }

        console.log(`[Cron] Sucesso: ${vipsParaExpirar.length} VIPs expirados.`);
      }
   } catch (error) {
      console.error('[Cron] Erro ao processar expirações:', error);
    } finally {
      isJobRunning = false;
    }
  });
};