const convertSteam2ToSteam64 = (steamId2: string): string => {

  if (!steamId2) return "";
  if (!steamId2.startsWith('STEAM_')) return steamId2; 
  const parts = steamId2.split(':');
  if (parts.length !== 3) return steamId2;
  
  const Y = BigInt(parts[1]);
  const Z = BigInt(parts[2]);
  const steam64 = (Z * 2n) + Y + 76561197960265728n;
  
  return steam64.toString();
};

export default convertSteam2ToSteam64;