import { Request, Response, NextFunction } from 'express';
import prisma from '../utils/prisma.util';


export const requireVerifiedMerchant = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (req.user.role !== 'MERCHANT') {
      return next(); // Not a merchant, skip check
    }
    
    const merchantProfile = await prisma.merchantProfile.findUnique({
      where: { userId: req.user.id },
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

