import axios from 'axios';
import fs from 'fs/promises';
import path from 'path';
import { queryGameServerInfo, queryGameServerPlayer } from 'steam-server-query';
import { ServerCache } from '../types';

const ZE_SERVER = { ip: '131.196.196.196', port: '27080' };

export let serverCache: ServerCache = {
  serverInfo: null,
  thumbnailUrl: null,
  lastUpdated: null,
};

const getThumbnailUrl = async (mapId: string): Promise<string | null> => {
  try {
    const response = await axios.post(
      'https://api.steampowered.com/ISteamRemoteStorage/GetPublishedFileDetails/v1/',
      { itemcount: 1, 'publishedfileids[0]': mapId },
      {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        timeout: 5000,
      }
    );

    const item = response.data?.response?.publishedfiledetails?.[0];
    return item?.preview_url || null;
  } catch (error) {
    console.error('Erro ao buscar thumbnail via API:', (error as Error).message);
    return null;
  }
};

export const updateServerInfo = async (): Promise<void> => {
  try {
    const gameServerAddress = `${ZE_SERVER.ip}:${ZE_SERVER.port}`;

    const [serverInfo, serverPlayerList] = await Promise.all([
      queryGameServerInfo(gameServerAddress),
      queryGameServerPlayer(gameServerAddress),
    ]);

    const filteredInfo = {
      name: serverInfo.name,
      map: serverInfo.map,
      players: serverInfo.players,
      maxPlayers: serverInfo.maxPlayers,
      playerList: serverPlayerList.players || [],
      ip: ZE_SERVER.ip,
      port: ZE_SERVER.port,
    };

    const mapDataRaw = await fs.readFile(
      path.join(__dirname, '../../mapsId/map_ids.json'),
      'utf-8'
    );
    const mapData: Record<string, string> = JSON.parse(mapDataRaw);

    const mapId = mapData[serverInfo.map];
    const thumbnailUrl = mapId ? await getThumbnailUrl(mapId) : null;

    serverCache = {
      serverInfo: filteredInfo,
      thumbnailUrl,
      lastUpdated: new Date().toISOString(),
    };
  } catch (error) {
    console.error('Erro ao atualizar informações do servidor:', (error as Error).message);
  }
};
