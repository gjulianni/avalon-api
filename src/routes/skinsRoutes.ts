import { Router } from 'express';
import { equipWeaponSkin, getPlayerInventory, syncPlayerSkins } from "../controllers/skinsController";

const skinsRouter = Router();

skinsRouter.post('/equip', equipWeaponSkin);
skinsRouter.get('/sync/:steamId', syncPlayerSkins);
skinsRouter.get('/inventory', getPlayerInventory);

export default skinsRouter;