import Rcon from 'rcon-srcds';

const executeRconAction = async (steamId: string, action: 'buy' | 'equip', uniqueId: string): Promise<string> => {
  try {
    const client = new Rcon({
      host: process.env.RCON_HOST || '',
      port: parseInt(process.env.RCON_PORT || '27015'),
      timeout: 2000
    });

    await client.authenticate(process.env.RCON_PASSWORD || '');
    
    const command = `css_avalon_web_action ${steamId} ${action} ${uniqueId}`;
    const response = await client.execute(command);
    
    await client.disconnect();
    
    return response.toString().trim();
  } catch (error) {
    console.error("[RCON] Falha ao comunicar com servidor de CS2:", error);
    return "RCON_FAILED"; 
  }
};

export default executeRconAction;