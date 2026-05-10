import { Router } from "express";
import { equipWeaponStickers } from "../controllers/stickersController";

const stickersRouter = Router();

stickersRouter.post('/equip', equipWeaponStickers);

export default stickersRouter;