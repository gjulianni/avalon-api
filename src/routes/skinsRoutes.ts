import { Router } from 'express';
import { equipWeaponSkin, getPlayerInventory, syncPlayerSkins } from "../controllers/skinsController";

const skinsRouter = Router();

skinsRouter.post('/equip', equipWeaponSkin);
skinsRouter.post('/sync', syncPlayerSkins);
skinsRouter.get('/inventory', getPlayerInventory);

export default skinsRouter;