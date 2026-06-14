import { Router } from 'express';
import { getPackages, checkout, syncCommands, getPendingOrder, getOrderStatus, validateCoupon } from '../controllers/storeController';
import { buyItem, equipItem, getCatalog, getPlayerStoreData, syncCatalog } from '../controllers/avalonStore/storeCatalogController';

const router = Router();

router.get('/packages', getPackages);
router.post('/checkout', checkout);
router.get('/pending-order', getPendingOrder);
router.get('/order/:id/status', getOrderStatus);
router.get('/sync-commands', syncCommands);
router.post('/coupon/validate', validateCoupon);

router.post('/sync-catalog', syncCatalog);
router.get('/catalog', getCatalog);
router.get('/player-store-data', getPlayerStoreData);
router.post('/buy', buyItem);
router.post('/equip', equipItem);

export default router;
