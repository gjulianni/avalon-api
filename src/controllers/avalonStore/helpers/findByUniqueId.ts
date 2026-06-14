const findItemByUniqueId = (node: any, targetId: string): any => {
  if (typeof node !== 'object' || node === null) return null;
  
  for (const key in node) {
    if (key === 'team' || key === 'flag') continue;
    
    const child = node[key];
    if (typeof child === 'object' && child !== null) {
      if (child.uniqueid === targetId) {
        // Encontrou! Retornamos o item e herdamos a tag 'flag' da categoria pai se existir
        return { ...child, flag: child.flag || node.flag };
      }
      const found = findItemByUniqueId(child, targetId);
      if (found) return found;
    }
  }
  return null;
};

export default findItemByUniqueId;