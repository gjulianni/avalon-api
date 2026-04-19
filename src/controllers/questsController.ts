import { Request, Response } from "express";
import { prisma } from "../database";

export const syncPlayerStats = async (req: Request, res: Response) => {

    const { players, serverMap } = req.body;
    const rewardsToDeliver: any[] = [];

    if (!players || !Array.isArray(players)) {
        return res.status(400).json({ success: false, error: 'Players ausentes ou formato inválido' });
    }

    try {

      await Promise.all(players.map(async (player) => {
         const { 
            steamId, zombieDamage = 0, bossDamage = 0, playtimeMinutes = 0, zombieTankDamage = 0, humansInfected = 0, roundsSurvived = 0,
            } = player;
            if (!steamId) return;

            await prisma.playerStats.upsert({
        where: { steamId: steamId },
        update: {
          zombieDamage: { increment: zombieDamage },
          bossDamage: { increment: bossDamage },
          playtimeMinutes: { increment: playtimeMinutes },
          zombieTankDamage: { increment: zombieTankDamage },
          humansInfected: { increment: humansInfected },
          roundsSurvived: { increment: roundsSurvived }
        },
        create: {
          steamId: steamId,
          zombieDamage: zombieDamage,
          bossDamage: bossDamage,
          playtimeMinutes: playtimeMinutes,
          zombieTankDamage: zombieTankDamage,
          humansInfected: humansInfected,
          roundsSurvived: roundsSurvived
        }
      });

      const activeQuests = await prisma.playerQuest.findMany({
        where: { 
          steamId: steamId, 
          status: 'IN_PROGRESS' 
        },
        include: { quest: true } 
      });
            
   for (const pq of activeQuests) {
        let addedProgress = 0;

        if (pq.quest.conditions && Array.isArray(pq.quest.conditions)) {
          const typedConditions = pq.quest.conditions as Array<{ field: string; value: string }>;
          const mapCondition = typedConditions.find(c => c.field === 'map');
          
          if (mapCondition && serverMap) {
            const allowedMaps = mapCondition.value.split(',').map(m => m.trim());
            const isMapAllowed = allowedMaps.some(allowedMap => serverMap.includes(allowedMap));
            
            if (!isMapAllowed) {
               continue; 
            }
          }
        }

        // Verifica qual o tipo da missão para saber o que somar
        if (pq.quest.type === 'ZOMBIE_DAMAGE') {
          addedProgress = zombieDamage;
        } else if (pq.quest.type === 'BOSS_DAMAGE') {
          addedProgress = bossDamage;
        } else if (pq.quest.type === 'PLAYTIME') {
          addedProgress = playtimeMinutes;
        } else if (pq.quest.type === 'ZOMBIE_INFECT') {
          addedProgress = humansInfected;
        } else if (pq.quest.type === 'ZOMBIE_TANK') {
          addedProgress = zombieTankDamage;
        } else if (pq.quest.type === 'ROUNDS_SURVIVED') {
          addedProgress = roundsSurvived;
        }

        if (addedProgress > 0) {
          const newProgress = pq.progress + addedProgress;
          const isCompleted = newProgress >= pq.quest.targetValue;

          await prisma.playerQuest.update({
            where: { id: pq.id },
            data: {
              progress: newProgress,
              status: isCompleted ? 'COMPLETED' : 'IN_PROGRESS'
            }
          });
        }
      }
        const pendingRewards = await prisma.playerQuest.findMany({
          where: {
            steamId: steamId,
            status: 'PENDING_DELIVERY'
          },
          include: { quest: true }
        });

        if (pendingRewards.length > 0) {

          rewardsToDeliver.push({
            steamId: steamId,
            items: pendingRewards.map(pr => {
              let parsedUniqueId = pr.quest.rewardItem;
              let durationDays = 0;

              if (parsedUniqueId && parsedUniqueId.includes(':')) {
                const parts = parsedUniqueId.split(':');
                parsedUniqueId = parts[0];
                durationDays = parseInt(parts[1], 10);
              }

              return {
                playerQuestId: pr.id,
                credits: pr.quest.rewardCredits,
                itemUniqueId: parsedUniqueId,
                durationDays: durationDays
              };
            })
          });

          await prisma.playerQuest.updateMany({
            where: { id: { in: pendingRewards.map(pr => pr.id) } },
            data: { status: 'CLAIMED' }
          });
        }

      }))

    return res.status(200).json({
      success: true,
      rewards: rewardsToDeliver
    });

  } catch (error) {
    return res.status(500).json({ success: false, error: "Erro no sync" });
  }
}