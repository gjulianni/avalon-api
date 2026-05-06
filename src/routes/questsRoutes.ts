import { Router } from "express";
import { syncPlayerStats } from "../controllers/questsController";
import { claimQuest, createQuest, getActiveQuests, getAllQuestsForMenu, getPlayerProgress, getPlayerStats, startQuest } from "../controllers/quests/questsManager";
import { checkAdmin } from "../middlewares/serverAdmin";

const questsRouter = Router();

questsRouter.post("/sync", syncPlayerStats);

questsRouter.get('/active', getActiveQuests);

questsRouter.post('/create', checkAdmin, createQuest);

questsRouter.get('/progress/:steamId', getPlayerProgress);
questsRouter.post('/start', startQuest);
questsRouter.post('/claim', claimQuest);
questsRouter.get('/menu/:steamId', getAllQuestsForMenu);
questsRouter.get('/stats/:steamId', getPlayerStats);

export default questsRouter;