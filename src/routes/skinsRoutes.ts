import { Router } from 'express';
import { equipWeaponSkin, getPlayerInventory, getValidSkinIds, syncPlayerSkins } from "../controllers/skinsController";

const skinsRouter = Router();

skinsRouter.post('/equip', equipWeaponSkin);
skinsRouter.get('/sync/:steamId', syncPlayerSkins);
skinsRouter.get('/inventory', getPlayerInventory);
skinsRouter.get('/valid-ids', getValidSkinIds);

export default skinsRouter;