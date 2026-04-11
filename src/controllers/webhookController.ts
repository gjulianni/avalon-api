import crypto from 'crypto';
import express, { Request, Response } from 'express';
import { prisma }from '../database';
import { processApprovedOrder } from '../helpers/processApprovedOrder';

const router = express.Router();

console.log("DATABASE_URL atual:", process.env.DATABASE_URL);

export const vipGroupMap: Record<number, string> = {
  499832: 'vip1',
  499833: 'vip2',
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

  const orderId = String(data?.internal_id || data?.order_id || data?.id);

  if (event === 'ORDER_APPROVED') {
    try {
      await processApprovedOrder(orderId, data);
      console.log(`[WEBHOOK SUCESSO] VIP processado pelo Helper para o pedido ${orderId}`);
    } catch (error) {
      console.error('[WEBHOOK ERRO] Falha ao processar helper:', error);
    }
  } else {
    console.log(`--- [DEBUG] Evento diferente de aprovado recebido: ${event}`);
  }

  if (orderId && data?.status) {
    try {
      await prisma.order.upsert({
        where: { id: orderId },
        update: { status: data.status },
        create: {
          id: orderId,
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