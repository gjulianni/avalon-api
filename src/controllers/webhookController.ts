import crypto from 'crypto';
import express, { Request, Response } from 'express';
import { prisma }from '../database';

const router = express.Router();

console.log("DATABASE_URL atual:", process.env.DATABASE_URL);

const commandMap: Record<number, (clientId: string, days: number) => string> = {
  499832: (clientId, days) => `sm_addvip "${clientId}" vip1 ${days}`,
  499833: (clientId, days) => `sm_addvip "${clientId}" vip2 ${days}`, 
};

function verifyWebhook(req: any, signature: string, timestamp: string, secret: string): boolean {
  const rawBody = req.rawBody ? req.rawBody.toString('utf8') : JSON.stringify(req.body);
  
  const expected = crypto
    .createHmac('sha256', secret)
    .update(`${timestamp}.${rawBody}`)
    .digest('hex');
  
  return signature === expected;
}

router.post('/centralcart', async (req: Request, res: Response): Promise<void> => {
  console.log('--- [DEBUG] INÍCIO DO PROCESSAMENTO ---');
  
  const signature = req.headers['x-centralcart-signature'] as string;
  const timestamp = req.headers['x-centralcart-timestamp'] as string;
  const secret = process.env.CC_WEBHOOK_SECRET as string;

  if (!signature || !timestamp) {
    console.error('erro: Tentativa de acesso sem headers de assinatura.');
    res.status(400).send('Missing headers');
    return;
  }

 if (!verifyWebhook(req, signature, timestamp, secret)) {
    console.error('❌ [ERRO] Assinatura inválida no processamento');
    res.status(401).send('Invalid signature');
    return;
  }

  const { event, data } = req.body;
  console.log('--- [DEBUG] Verificando Evento:', event);

  if (event === 'ORDER_APPROVED') {
    const clientId = data.client_identifier; 
  
    if (clientId && data.packages) { 
      for (const item of data.packages) {
        const pkgId = Number(item.package_id);
        const buildCommand = commandMap[pkgId];
        
        if (buildCommand) {
          const days = item.quantity * 30;
          const command = buildCommand(clientId, days);
          
          try {
            console.log('--- [DEBUG] Tentando salvar no SQLite...');
            const result = await prisma.pendingCommand.create({
              data: {
                command: command,
                executed: false
              }
            });
            console.log('[SUCESSO] Salvo no banco com ID:', result.id);
          } catch (error) {
            console.error('[ERRO PRISMA]:', error);
          }
        } else {
          console.warn(' [AVISO] O ID', pkgId, 'não existe no seu commandMap!');
          console.log('IDs disponíveis no seu mapa:', Object.keys(commandMap));
        }
      }
    } else {
      console.log('--- [DEBUG] Falha: clientId ou packages ausentes no data');
    }
  } else {
    console.log('--- [DEBUG] Evento ignorado (não é ORDER_APPROVED)');
  }

  const orderId = data?.internal_id || data?.order_id || data?.id;

  if (orderId && data?.status) {
    try {
      await prisma.order.upsert({
        where: { id: String(orderId) },
        update: { status: data.status },
        create: {
          id: String(orderId),
          status: data.status,
          userId: data.client_identifier ?? '',
        }
      });
    } catch (dbError) {
      console.error(dbError);
    }
  }

  res.status(200).send('OK');
});

export default router;