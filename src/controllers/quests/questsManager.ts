import { Request, Response } from "express";
import { prisma } from "../../database";
import { SteamUser } from "../../types";

export const getActiveQuests = async (req: Request, res: Response) => {
  try {
    const quests = await prisma.quest.findMany({
      where: { isActive: true }
    });

    return res.status(200).json({ success: true, data: quests });
  } catch (error) {
    console.error("Erro ao buscar missões:", error);
    return res.status(500).json({ success: false, error: 'Erro interno ao buscar missões' });
  }
};

export const getAllQuestsForMenu = async (req: Request, res: Response) => {
  const { steamId } = req.params;

  try {
    const activeQuests = await prisma.quest.findMany({
      where: { isActive: true }
    });

    const playerProgress = await prisma.playerQuest.findMany({
      where: { steamId: steamId }
    });

    const unifiedList = activeQuests.map(quest => {
    const progress = playerProgress.find(p => p.questId === quest.id);

      let formattedDate = "Permanente";
      if (quest.expiresAt) {
        formattedDate = new Date(quest.expiresAt).toLocaleString('pt-BR', { 
          timeZone: 'America/Sao_Paulo',
          day: '2-digit', month: '2-digit', year: 'numeric',
          hour: '2-digit', minute: '2-digit'
        });
      }
      
      return {
        ...quest,
        expiresAtBR: formattedDate,
        userProgress: progress ? {
          progress: progress.progress,
          status: progress.status
        } : null
      };
    });

    return res.status(200).json({ success: true, data: unifiedList });
  } catch (error) {
    console.error("Erro ao montar menu unificado:", error);
    return res.status(500).json({ success: false, error: "Erro interno" });
  }
};

export const createQuest = async (req: Request, res: Response) => {
  const { 
    title, description, type, targetValue, 
    eventName, useridField, conditions, 
    rewardCredits, rewardItem, duration 
  } = req.body;

  // Validação básica
  if (!title || !eventName || !useridField || !targetValue) {
    return res.status(400).json({ success: false, error: 'Campos obrigatórios faltando.' });
  }

  try {

    let expiresAt = new Date();

    // Lógica para definir o tempo de expiração
    if (duration === 'DAILY') {
      expiresAt.setDate(expiresAt.getDate() + 1);
    } else if (duration === 'WEEKLY') {
      expiresAt.setDate(expiresAt.getDate() + 7);
    } else if (duration === 'MONTHLY') {
      expiresAt.setMonth(expiresAt.getMonth() + 1);
    } else {
      return res.status(400).json({ success: false, error: 'Duração inválida. Use DAILY, WEEKLY ou MONTHLY.' });
    }

    const newQuest = await prisma.quest.create({
      data: {
        title,
        description,
        type,
        targetValue,
        eventName,
        useridField,
        conditions: conditions || [], 
        rewardCredits: rewardCredits || 0,
        rewardItem: rewardItem || null,
        expiresAt: expiresAt,
        isActive: true
      }
    });

    return res.status(201).json({ success: true, message: 'Missão criada com sucesso!', data: newQuest });
  } catch (error) {
    console.error("Erro ao criar missão:", error);
    return res.status(500).json({ success: false, error: 'Erro interno ao criar missão' });
  }
};


export const getPlayerProgress = async (req: Request, res: Response) => {
  const { steamId } = req.params;

  if (!steamId) {
    return res.status(400).json({ success: false, error: 'SteamID não fornecido.' });
  }

  try {
    const progress = await prisma.playerQuest.findMany({
      where: { 
        steamId: steamId,
      },
      include: { 
        quest: {
          select: {
            id: true,
            title: true,
            targetValue: true,
            rewardCredits: true
          }
        } 
      }
    });

    return res.status(200).json({ success: true, data: progress });
  } catch (error) {
    console.error("Erro ao buscar progresso:", error);
    return res.status(500).json({ success: false, error: 'Erro interno ao buscar progresso' });
  }
};

export const startQuest = async (req: Request, res: Response): Promise<void> => {
  // 1. Verifica se o usuário está logado
  if (!req.isAuthenticated() || !req.user) {
    res.status(401).json({ success: false, error: 'Você precisa estar logado para iniciar uma missão.' });
    return;
  }

  const user = req.user as SteamUser; 

  const { questId } = req.body;

  if (!questId) {
    res.status(400).json({ success: false, error: 'ID da missão não fornecido.' });
    return;
  }

  try {
    const existingQuest = await prisma.playerQuest.findUnique({
      where: {
        steamId_questId: { 
          steamId: user.id,
          questId: Number(questId)
        }
      }
    });

    if (existingQuest) {
      res.status(400).json({ success: false, error: 'Você já iniciou ou completou esta missão.' });
      return;
    }

    const newPlayerQuest = await prisma.playerQuest.create({
      data: {
        steamId: user.id,
        questId: Number(questId),
        progress: 0,
        status: 'IN_PROGRESS'
      }
    });

    res.status(201).json({ success: true, message: 'Missão iniciada com sucesso!', data: newPlayerQuest });
  } catch (error) {
    console.error("Erro ao iniciar missão:", error);
    res.status(500).json({ success: false, error: 'Erro interno ao iniciar missão.' });
  }
};

export const claimQuest = async (req: Request, res: Response) => {
  const { playerQuestId } = req.body;
  const user = req.user as any;

  try {


    const pq = await prisma.playerQuest.findUnique({
      where: { id: Number(playerQuestId) },
      include: { quest: true }
    });

    if (!pq || pq.steamId !== user.id) {
      return res.status(403).json({ success: false, error: "Acesso negado." });
    }

    if (pq.status !== 'COMPLETED') {
      return res.status(400).json({ success: false, error: "Esta missão ainda não foi concluída ou já foi resgatada." });
    }

    const updated = await prisma.playerQuest.updateMany({
      where: { 
        id: Number(playerQuestId),
        steamId: user.id, 
        status: 'COMPLETED' 
      },
      data: { status: 'PENDING_DELIVERY' }
    });

    if (updated.count === 0) {
      return res.status(400).json({ success: false, error: "Acesso negado, missão incompleta ou já resgatada." });
    }

    return res.status(200).json({ 
      success: true, 
      message: "Resgate solicitado! Entre no servidor para receber sua recompensa." 
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: "Erro ao processar resgate." });
  }
};

export const getPlayerStats = async (req: Request, res: Response) => {
  const { steamId } = req.params;
  const user = req.user as any;

  if (!user) {
    return res.status(401).json({
      success: false,
      error: 'Não autorizado. Faça login para visualizar estes dados.'
    });
  }

  if (user.id !== steamId) {
    return res.status(403).json({ 
      success: false, 
      error: 'Você não tem permissão para visualizar estes dados.' 
    });
  }

  try {
    const ps = await prisma.playerStats.findUnique({
      where: { steamId }
    });

    if (!ps) {
      return res.status(404).json({ 
        success: false, 
        error: 'Estatísticas não encontradas.' 
      });
    }

    return res.status(200).json({ success: true, data: ps });

  } catch (error) {
    console.error(error);
    return res.status(500).json({ 
      success: false, 
      error: 'Erro interno no servidor.' 
    });
  }
}