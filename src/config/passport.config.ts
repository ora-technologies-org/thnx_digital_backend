import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import prisma from '../utils/prisma.util';

export const configurePassport = () => {
  // Serialize user for session
  passport.serializeUser((user: any, done) => {
    done(null, user.id);
  });

  // Deserialize user from session
  passport.deserializeUser(async (id: string, done) => {
    try {
      const user = await prisma.user.findUnique({
        where: { id },
      });
      done(null, user);
    } catch (error) {
      done(error, null);
    }
  });

  // Google OAuth Strategy
  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID!,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
        callbackURL: process.env.GOOGLE_CALLBACK_URL!,
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          // Check if user exists with Google ID
          let user = await prisma.user.findUnique({
            where: { googleId: profile.id },
            include: { merchantProfile: true },
          });

          if (user) {
            // User exists, update last login
            user = await prisma.user.update({
              where: { id: user.id },
              data: { lastLogin: new Date() },
              include: { merchantProfile: true },
            });
            return done(null, user);
          }

          // Check if user exists with the same email
          const existingUserByEmail = await prisma.user.findUnique({
            where: { email: profile.emails?.[0]?.value },
          });

          if (existingUserByEmail) {
            // Link Google account to existing user
            user = await prisma.user.update({
              where: { id: existingUserByEmail.id },
              data: {
                googleId: profile.id,
                provider: 'google',
                avatar: profile.photos?.[0]?.value,
                emailVerified: true,
                lastLogin: new Date(),
              },
              include: { merchantProfile: true },
            });
            return done(null, user);
          }

          // Create new user
          user = await prisma.user.create({
            data: {
              email: profile.emails?.[0]?.value || '',
              name: profile.displayName,
              googleId: profile.id,
              provider: 'google',
              avatar: profile.photos?.[0]?.value,
              emailVerified: true,
              role: 'USER', // Default role for Google sign-in
              lastLogin: new Date(),
            },
            include: { merchantProfile: true },
          });

          done(null, user);
        } catch (error) {
          done(error as Error, undefined);
        }
      }
    )
  );
};

export default passport;