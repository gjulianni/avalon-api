import cron from 'node-cron';
import { prisma } from '../database';

function getRandomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function getRandomElement(arr: any[]): any {
  return arr[Math.floor(Math.random() * arr.length)];
}

export async function cleanUpExpiredQuests() {
   try {
    const now = new Date();

    console.log('[AVALON CLEANUP] Iniciando a faxina de missões expiradas...');

    const deletedPlayerQuests = await prisma.playerQuest.deleteMany({
      where: {
        quest: {
          expiresAt: { lt: now } 
        }
      }
    });

    const deletedQuests = await prisma.quest.deleteMany({
      where: {
        expiresAt: { lt: now }
      }
    });

    if (deletedQuests.count > 0) {
      console.log(`[AVALON CLEANUP] Sucesso: ${deletedQuests.count} quests e ${deletedPlayerQuests.count} progressos removidos.`);
    } else {
      console.log('[AVALON CLEANUP] Nenhuma missão expirada para remover.');
    }
  } catch (error) {
    console.error('[AVALON CLEANUP] Erro durante a limpeza:', error);
  }
}


async function generateQuestsForTier(tier: 'DAILY' | 'WEEKLY' | 'MONTHLY', amountToGenerate: number, hoursToRule: number) {
  try {
    const templates = await prisma.questTemplate.findMany({
      where: { tier: tier }
    });

    if (templates.length === 0) {
      console.log(`[AVALON BOT] Nenhum template encontrado para ${tier}.`);
      return;
    }

    console.log(`[AVALON BOT] Gerando ${amountToGenerate} missões ${tier}...`);

    for (let i = 0; i < amountToGenerate; i++) {
      const selectedTemplate = getRandomElement(templates);

      const titles = selectedTemplate.titles as string[];
      const descriptions = selectedTemplate.descriptions as string[];

      const finalTarget = getRandomInt(selectedTemplate.minTarget, selectedTemplate.maxTarget);
      const finalReward = getRandomInt(selectedTemplate.minReward, selectedTemplate.maxReward);
      const rawDescription = getRandomElement(selectedTemplate.descriptions);
      const finalTitle = getRandomElement(titles);
      const finalDescription = rawDescription.replace('{TARGET}', finalTarget.toLocaleString('pt-BR'));
   
      const expirationDate = new Date(Date.now() + hoursToRule * 60 * 60 * 1000);
      expirationDate.setUTCHours(2, 59, 59, 0); 

      await prisma.quest.create({
        data: {
          title: finalTitle,
          description: finalDescription,
          type: selectedTemplate.type,
          targetValue: finalTarget,
          rewardCredits: finalReward,
          expiresAt: expirationDate,
          conditions: selectedTemplate.baseConditions || [],
          isActive: true,
          eventName: selectedTemplate.eventName || null,
    useridField: selectedTemplate.useridField || null,
    rewardItem: null
        }
      });
    }
    
    console.log(`[AVALON BOT] Lote ${tier} gerado com sucesso!`);
  } catch (error) {
    console.error(`[AVALON BOT] Erro ao gerar quests ${tier}:`, error);
  }
}

export function startQuestGenerator() {
  console.log('[AVALON BOT] Robô gerador de missões inicializado.');

  const cronOptions = {
    timezone: "America/Sao_Paulo"
  };
cron.schedule('0 0 * * *', async () => {
    try {
      
      await cleanUpExpiredQuests(); 
      
      await generateQuestsForTier('DAILY', 3, 24); 
    } catch (error) {
      console.error('[AVALON] Erro na virada do dia:', error);
    }
  }, cronOptions);
  cron.schedule('0 0 * * 0', async () => {
    await generateQuestsForTier('WEEKLY', 2, 168);
  }, cronOptions);
  cron.schedule('0 0 1 * *', async () => {
    await generateQuestsForTier('MONTHLY', 1, 720);
  }, cronOptions);
}