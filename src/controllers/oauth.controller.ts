import { Request, Response } from 'express';
// import { generateTokens } from '../utils/jwt.util';
import prisma from '../utils/prisma.util';
import { generateTokens } from '../utils/jwt.util';

/**
 * Google OAuth Success Callback
 * Called after successful Google authentication
 */
export const googleAuthSuccess = async (req: Request, res: Response) => {
  try {
    const user = req.user as any;

    if (!user) {
      return res.redirect(`${process.env.FRONTEND_URL}/login?error=authentication_failed`);
    }

    // Check if merchant is verified (only for merchants)
    const isVerified = user.role === 'MERCHANT' 
      ? user.merchantProfile?.isVerified || false 
      : true;

    // Generate tokens
    const tokens = generateTokens({
      userId: user.id,
      email: user.email,
      role: user.role,
      isVerified,
    });

    // Store refresh token
    await prisma.refreshToken.create({
      data: {
        token: tokens.refreshToken,
        userId: user.id,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      },
    });

    // Redirect to frontend with tokens
    const redirectUrl = `${process.env.FRONTEND_URL}/auth/callback?accessToken=${tokens.accessToken}&refreshToken=${tokens.refreshToken}`;
    
    return res.redirect(redirectUrl);
  } catch (error: any) {
    console.error('Google auth success error:', error);
    return res.redirect(`${process.env.FRONTEND_URL}/login?error=server_error`);
  }
};

/**
 * Google OAuth Failure Callback
 */
export const googleAuthFailure = (req: Request, res: Response) => {
  return res.redirect(`${process.env.FRONTEND_URL}/login?error=google_auth_failed`);
};