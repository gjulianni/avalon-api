import { Router } from 'express';
import passport from 'passport';
import { getUser, logout, steamReturn } from '../controllers/authController';

const router = Router();

router.get(
  '/steam', 
  passport.authenticate('steam', { failureRedirect: `${process.env.FRONTEND_URL}?error=auth_failed` })
);

router.get(
  '/steam/return',
  passport.authenticate('steam', { failureRedirect: `${process.env.FRONTEND_URL}?error=auth_failed` }),
  steamReturn
);

router.get('/user', getUser);

router.post('/logout', logout);

export default router;
