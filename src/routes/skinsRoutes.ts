import { Router } from 'express';
import { equipWeaponSkin, getPlayerInventory } from "../controllers/skinsController";

const skinsRouter = Router();

skinsRouter.post('/equip', equipWeaponSkin);
skinsRouter.get('/inventory', getPlayerInventory);

export default skinsRouter;