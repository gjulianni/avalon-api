import { Request, Response } from 'express';
import axios from 'axios';
import fs from 'fs/promises';
import path from 'path';
import { ServerCache } from '../types';
import { io } from '../index'; 

export let serverCache: ServerCache = {
  serverInfo: null,
  thumbnailUrl: null,
  lastUpdated: null,
  roundStartTime: null
};


const getThumbnailUrl = async (mapData: any): Promise<string | null> => {
  if (!mapData || mapData.provider === 'none') return null;

  if (mapData.provider === 'gamebanana' && mapData.url) {
    return mapData.url;
  }

  if (mapData.provider === 'steam' && mapData.id) {
    try {
      const response = await axios.post(
        'https://api.steampowered.com/ISteamRemoteStorage/GetPublishedFileDetails/v1/',
        { itemcount: 1, 'publishedfileids[0]': mapData.id },
        {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          timeout: 5000,
        }
      );
      const item = response.data?.response?.publishedfiledetails?.[0];
      return item?.preview_url || null;
    } catch (error) {
      console.error('Erro na Steam API:', (error as Error).message);
      return null;
    }
  }

  return null;
};

export const updateLiveStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const payload = req.body;
  
    res.sendStatus(200);

    if (!payload || !payload.event) return;

    // SNAPSHOT (Início do Round)
    if (payload.event === 'snapshot') {
      const serverInfo = payload.serverInfo;
      let thumbnailUrl = null;

      try {
        const mapDataRaw = await fs.readFile(
          path.join(__dirname, '../../mapsId/map_ids.json'),
          'utf-8'
        );
        const mapData: Record<string, string> = JSON.parse(mapDataRaw);
        
        const mapId = mapData[serverInfo.map];
        thumbnailUrl = mapId ? await getThumbnailUrl(mapId) : null;
      } catch (err) {
        console.error('Erro ao ler map_ids.json ou buscar thumbnail:', err);
      }
      serverCache = {
        serverInfo: serverInfo,
        thumbnailUrl,
        lastUpdated: new Date().toISOString(),
        roundStartTime: new Date().toISOString()
      };

      console.log(`[Tracker] Snapshot Recebido! Mapa: ${serverInfo.map} | Players: ${serverInfo.players}`);
      io.emit('live_status_snapshot', serverCache);
      return;
    }

    // 2. DELTAS (Ações durante o round)
    if (!serverCache.serverInfo || !serverCache.serverInfo.playerList) return;

    const { data } = payload;
    const playerList = serverCache.serverInfo.playerList;

    switch (payload.event) {
      case 'infection':
        const victimInfect = playerList.find((p: any) => p.index === data.victim);
        if (victimInfect) {
          victimInfect.team = 2; // Time 2 = TR = Zumbi
          victimInfect.isZombie = true;
          io.emit('live_status_infection', { victim: victimInfect, isMotherZombie: data.isMotherZombie });
        }
        break;

      case 'spawn':
        const playerSpawn = playerList.find((p: any) => p.index === data.index);
        if (playerSpawn) {
          playerSpawn.isAlive = data.isAlive;
          playerSpawn.isZombie = data.isZombie;
        }
      break;

      case 'death':
        const victimDeath = playerList.find((p: any) => p.index === data.victim);
        if (victimDeath) {
          victimDeath.isAlive = false;

          if (data.attacker && data.attackerScore !== undefined) {
          const attackerDeath = playerList.find((p: any) => p.index === data.attacker);
          if (attackerDeath) {
            attackerDeath.score = data.attackerScore;
          }
        }
          io.emit('live_status_death', { victim: victimDeath });
        }
        break;

      case 'disconnect':
      
        serverCache.serverInfo.playerList = playerList.filter((p: any) => p.index !== data.player);
        serverCache.serverInfo.players = serverCache.serverInfo.playerList.length;
        io.emit('live_status_disconnect', { playerIndex: data.player });
        break;

      case 'connect':
        const existingPlayer = playerList.find((p: any) => p.index === data.index);
        
        if (existingPlayer) {
          Object.assign(existingPlayer, data);
        } else {
          playerList.push(data);
          serverCache.serverInfo.players = playerList.length;
        }
        io.emit('live_status_connect', { player: data });
        break;

      case 'team_change':
        const playerToUpdate = playerList.find((p: any) => p.index === data.index);
        
        if (playerToUpdate) {
          playerToUpdate.team = data.team;
          playerToUpdate.isAlive = data.isAlive;
          playerToUpdate.isZombie = data.isZombie;
          if (data.score !== undefined) playerToUpdate.score = data.score;
        }
        break;
    }

    if (['infection', 'death'].includes(payload.event)) {
      io.emit('live_status_killfeed', {
        event: payload.event,
        data: payload.data,
        timestamp: Date.now()
      });
    }

    // Atualiza a hora da última alteração
    serverCache.lastUpdated = new Date().toISOString();
    io.emit('live_status_update', serverCache);

  } catch (error) {
    console.error("[Tracker] Erro ao processar Live Status:", error);
  }
};

export const getLiveStatus = (req: Request, res: Response): void => {
  res.json(serverCache);
};