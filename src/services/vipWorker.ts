import Rcon from 'rcon-srcds';

export async function executeRcon(command: string): Promise<string> {
  const rcon = new Rcon({
    host: process.env.RCON_HOST || '127.0.0.1',
    port: parseInt(process.env.RCON_PORT || '27015'),
    timeout: 5000,
  });

  await rcon.authenticate(process.env.RCON_PASSWORD || '');
  const response = await rcon.execute(command) as string;
  await rcon.disconnect();
  return response || '';
}