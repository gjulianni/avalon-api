import { Router } from 'express';
import { equipMusicKit, equipWeaponSkin, getPlayerInventory } from "../controllers/skinsController";

const skinsRouter = Router();

skinsRouter.post('/equip', equipWeaponSkin);
skinsRouter.get('/inventory', getPlayerInventory);
skinsRouter.post('/equip-music', equipMusicKit);

export default skinsRouter;