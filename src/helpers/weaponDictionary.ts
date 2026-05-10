export const weaponNameToIndex: Record<string, number> = {
  'deagle': 1,
  'elite': 2, // Dual Berettas
  'fiveseven': 3,
  'glock': 4,
  'ak47': 7,
  'aug': 8,
  'awp': 9,
  'famas': 10,
  'g3sg1': 11,
  'galilar': 13,
  'm249': 14,
  'm4a1': 16, // M4A4 (a engine chama de m4a1)
  'mac10': 17,
  'p90': 19,
  'mp5sd': 23,
  'ump45': 24,
  'xm1014': 25,
  'bizon': 26,
  'mag7': 27,
  'negev': 28,
  'sawedoff': 29,
  'tec9': 30,
  'hkp2000': 32, // P2000
  'mp7': 33,
  'mp9': 34,
  'nova': 35,
  'p250': 36,
  'scar20': 38,
  'sg556': 39,
  'ssg08': 40,
  'm4a1_silencer': 60, // Essa é a M4A1-S
  'usp_silencer': 61,
  'cz75a': 63,
  'revolver': 64
};


export const weaponIndexToName: Record<number, string> = 
  Object.entries(weaponNameToIndex).reduce((acc, [key, value]) => {
    acc[value] = key;
    return acc;
  }, {} as Record<number, string>);