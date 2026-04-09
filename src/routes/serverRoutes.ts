import { Router } from 'express';
import { getServerInfo } from '../controllers/serverController';

const router = Router();

router.get('/', getServerInfo);

export default router;
