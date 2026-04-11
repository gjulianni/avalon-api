import { Request, Response } from 'express';
import { CheckoutRequestBody } from '../types';
import { prisma }from '../database';
import { processApprovedOrder } from '../helpers/processApprovedOrder';


const CC_API = 'https://api.centralcart.com.br/v1';

const webstoreHeaders = () => ({
  'Content-Type': 'application/json',
  'x-store-domain': process.env.CENTRALCART_STORE_DOMAIN as string,
});

export const getPackages = async (_req: Request, res: Response): Promise<void> => {
  try {
    const response = await fetch(`${CC_API}/webstore/package`, {
      method: 'GET',
      headers: webstoreHeaders(),
    });
    
    if (!response.ok) {
      throw new Error(`HTTP Error: ${response.status}`);
    }
    
    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('CentralCart Packages Error:', (error as Error).message);
    res.status(500).json({ error: 'Failed to fetch packages' });
  }
};

export const getPendingOrder = async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) return res.status(401).json({ error: 'Unauthorized' });

  const steamUser = req.user as any;
  const accountId = BigInt(steamUser.id) - BigInt('76561197960265728');
  const y = accountId % 2n;
  const z = accountId / 2n;
  const steamIdString = `STEAM_1:${y}:${z}`;

  let order = await prisma.order.findFirst({
    where: {
      userId: steamIdString,
      status: 'PENDING',
      createdAt: { gte: new Date(Date.now() - 30 * 60 * 1000) }
    },
    orderBy: { createdAt: 'desc' },
  });

  if (order) {
    try {
      const response = await fetch(`${CC_API}/app/order/${order.id}`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Authorization': `Bearer ${process.env.CENTRALCART_API_KEY}`,
        },
      });

      if (response.ok) {
        const remoteOrder: any = await response.json();

        const finalStatuses = ['APPROVED', 'CANCELED', 'ABANDONED', 'REJECTED', 'CHARGEDBACK', 'REFUNDED'];
        if (remoteOrder && finalStatuses.includes(remoteOrder.status)) {
          
          if (remoteOrder.status === 'APPROVED') {
            await processApprovedOrder(order.id, remoteOrder);
          } else {
            await prisma.order.update({
              where: { id: order.id },
              data: { status: remoteOrder.status }
            });
          }
          
          return res.json({ order: null });
        }
      }
    } catch (err) {
      console.error("Erro no getPendingOrder:", err);
    }
  }

  res.json({ order });
};

export const validateCoupon = async (req: Request, res: Response) => {
  const { code } = req.body;

  if (!code) {
    return res.status(400).json({ error: 'Código do cupom inválido.' });
  }

  try {

    const response = await fetch(`${CC_API}/app/discount`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.CENTRALCART_API_KEY}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Status: ${response.status}`);
      console.error(`Detalhes:`, errorText);
      return res.status(400).json({ error: 'Erro de comunicação com o gateway.' });
    }

    const json: any = await response.json();
   
    const discount = json.data?.find(
      (c: any) => c.coupon.toUpperCase() === code.toUpperCase()
    );

    if (!discount) {
      return res.status(404).json({ error: 'Cupom inválido ou não encontrado.' });
    }

    if (discount.max_uses !== null && discount.uses >= discount.max_uses) {
      return res.status(400).json({ error: 'Este cupom já atingiu o limite de uso.' });
    }

    if (discount.expires_in !== null) {
      const expirationDate = new Date(discount.expires_in);
      if (expirationDate < new Date()) {
        return res.status(400).json({ error: 'Este cupom está expirado.' });
      }
    }

    res.json({
      success: true,
      code: discount.coupon,
      type: discount.type,
      value: discount.value
    });
    
  } catch (error) {
    console.error('erro interno: validateCoupon:', error);
    res.status(500).json({ error: 'Erro interno ao processar o cupom.' });
  }
};

export const getOrderStatus = async (req: Request, res: Response) => {
  const { id } = req.params;
  let order = await prisma.order.findUnique({ where: { id } });

  if (!order) return res.status(404).json({ error: 'Order not found' });

  if (order.status === 'PENDING') {
    try {
      const response = await fetch(`${CC_API}/app/order/${id}`, {
        method: 'GET',
        headers: {
          ...webstoreHeaders(),
          'Authorization': `Bearer ${process.env.CENTRALCART_API_TOKEN}`,
        },
      });
      const remoteOrder: any = await response.json();

      if (remoteOrder && remoteOrder.status) {
        const finalStatuses = ['APPROVED', 'CANCELED', 'ABANDONED', 'REJECTED', 'CHARGEDBACK', 'REFUNDED'];
        if (finalStatuses.includes(remoteOrder.status)) {
          if (remoteOrder.status === 'APPROVED') {
            await processApprovedOrder(id, remoteOrder);
          } else {
            await prisma.order.update({
              where: { id },
              data: { status: remoteOrder.status }
            });
          }

        }
      }
    } catch (err) {
      console.error("Erro ao consultar CentralCart:", err);
    }
  }

  res.json({ status: order.status });
};

export const checkout = async (
  req: Request<{}, {}, CheckoutRequestBody>,
  res: Response
): Promise<void> => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const { packageId, gateway, quantity, email, coupon } = req.body;
  const steamUser = req.user as any;

  const accountId = BigInt(steamUser.id) - BigInt('76561197960265728');
  const y = accountId % 2n;
  const z = accountId / 2n;
  const steamIdString = `STEAM_1:${y}:${z}`;
  try {
    const payload: any = {
      gateway,
      client_name: steamUser.displayName,
      client_email: email,
      terms: true,
      client_identifier: steamIdString,
      fields: {
        client_identifier: steamIdString,
      },
      cart: [
        {
          package_id: Number(packageId),
          quantity: Number(quantity),
        },
      ],
    };

    if (coupon) {
      payload.coupon = coupon;
    }

    const response = await fetch(`${CC_API}/webstore/checkout`, {
      method: 'POST',
      headers: webstoreHeaders(),
      body: JSON.stringify(payload),
    });

    const raw: any = await response.json();

    if (!response.ok) {
      console.error("ERRO CENTRALCART:", JSON.stringify(raw, null, 2));
      res.status(response.status).json({ error: raw.message || 'Erro de validação na API da loja.' });
      return;
    }

    const finalUrl = raw.checkout_url || raw.return_url;

    if (raw.order_id) {
      const initialStatus = raw.status || 'PENDING';
      await prisma.order.upsert({
        where: { id: raw.order_id },
        update: {},
        create: {
          id: raw.order_id,
          status: raw.status || 'PENDING',
          pixCode: raw.pix_code ?? null,
          qrCode: raw.qr_code ?? null,
          checkoutUrl: finalUrl ?? null,
          price: raw.formatted_price ?? null,
          userId: steamIdString,
        },
      });

      if (initialStatus === 'APPROVED') {
        try {
          const ccResponse = await fetch(`${CC_API}/app/order/${raw.order_id}`, {
            method: 'GET',
            headers: {
              ...webstoreHeaders(),
              'Authorization': `Bearer ${process.env.CENTRALCART_API_TOKEN}`,
            },
          });
          
          if (ccResponse.ok) {
            const fullRemoteOrder: any = await ccResponse.json();
            await processApprovedOrder(raw.order_id, fullRemoteOrder);
          }
        } catch (err) {
          console.error("Erro ao processar aprovação instantânea no checkout:", err);
        }
      }
    }

    res.json({
      checkoutUrl: finalUrl,
      pixCode: raw.pix_code,
      qrCode: raw.qr_code,
      orderId: raw.order_id,
      price: raw.formatted_price,
      expiresAt: Date.now() + 30 * 60 * 1000,
    });
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

export const syncCommands = async (req: Request, res: Response) => {
  const commands = await prisma.pendingCommand.findMany({ where: { executed: false } });

  const toAdd = await prisma.vipOrder.findMany({
    where: { status: "ACTIVE", notifiedAdd: false }
  });

  const toRemove = await prisma.vipOrder.findMany({
    where: { status: "EXPIRED", notifiedDel: false }
  });

  if (commands.length === 0 && toAdd.length === 0 && toRemove.length === 0) {
    return res.send("");
  }
  
const finalCommandsList: string[] = [];

  commands.forEach(c => finalCommandsList.push(c.command));

toAdd.forEach(order => {
    finalCommandsList.push(`sm_addvip "${order.steamId}" ${order.vipGroup} ${order.durationDays}`);
  });
  
  toRemove.forEach(order => {
    finalCommandsList.push(`sm_delvip "${order.steamId}"`);
  });

  if (commands.length > 0) {
    await prisma.pendingCommand.updateMany({
      where: { id: { in: commands.map(c => c.id) } },
      data: { executed: true }
    });
  }

  if (toAdd.length > 0) {
    await prisma.vipOrder.updateMany({
      where: { id: { in: toAdd.map(o => o.id) } },
      data: { notifiedAdd: true }
    });
  }

  if (toRemove.length > 0) {
    await prisma.vipOrder.updateMany({
      where: { id: { in: toRemove.map(o => o.id) } },
      data: { notifiedDel: true }
    });
  }
  const responseBody = finalCommandsList.join(";").trim();

  console.log(`Enviando para o servidor: "${responseBody}"`);

  res.set({
    'Content-Type': 'text/plain; charset=utf-8',
    'Content-Length': Buffer.byteLength(responseBody).toString(),
  });

  res.status(200).send(responseBody);
};