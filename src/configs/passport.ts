import passport from 'passport';
import { Strategy as SteamStrategy } from 'passport-steam';
import { SteamUser } from '../types';

export const configurePassport = (): void => {
  passport.use(
    new SteamStrategy(
      {
        returnURL: `${process.env.BACKEND_URL}/api/auth/steam/return`,
        realm: `${process.env.BACKEND_URL}/`,
        apiKey: process.env.STEAM_API_KEY as string,
      },
      (_identifier: string, profile: SteamUser, done: (err: null, user: SteamUser) => void) => {
        return done(null, profile);
      }
    )
  );

  passport.serializeUser((user, done) => done(null, user));
  passport.deserializeUser((obj, done) => done(null, obj as SteamUser));
};
