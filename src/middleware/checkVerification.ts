import { Request, Response, NextFunction } from 'express';
import prisma from '../utils/prisma.util';

export const requireVerifiedMerchant = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized',
      });
    }

    if (req.authUser?.role !== 'MERCHANT') {
      return next();
    }
    const merchantProfile = await prisma.merchantProfile.findUnique({
      where: { userId: req.authUser.userId },
    });
    
    if (!merchantProfile) {
      return res.status(404).json({
        success: false,
        message: 'Merchant profile not found',
      });
    }
    
    if (merchantProfile.profileStatus !== 'VERIFIED') {
      return res.status(403).json({
        success: false,
        message: 'Your profile is not verified yet. Please complete your profile and wait for admin approval.',
        profileStatus: merchantProfile.profileStatus,
      });
    }
    
    next();
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Error checking verification status',
    });
  }
};
