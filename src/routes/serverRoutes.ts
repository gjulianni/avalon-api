import { Router } from 'express';
import { getServerInfo } from '../controllers/serverController';
import { getLiveStatus, updateLiveStatus } from '../configs/serverCache';

const router = Router();

router.get('/', getServerInfo);
router.post('/live-status', updateLiveStatus); 
router.get('/live-status', getLiveStatus);

export default router;
