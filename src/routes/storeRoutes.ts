import { Router } from 'express';
import { getPackages, checkout, syncCommands, getPendingOrder, getOrderStatus, validateCoupon } from '../controllers/storeController';

const router = Router();

router.get('/packages', getPackages);
router.post('/checkout', checkout);
router.get('/pending-order', getPendingOrder);
router.get('/order/:id/status', getOrderStatus);
router.get('/sync-commands', syncCommands);
router.post('/coupon/validate', validateCoupon);

export default router;
