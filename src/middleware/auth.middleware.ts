import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../utils/jwt.util';

// Extend Request with our custom auth property
declare global {
  namespace Express {
    interface Request {
      authUser?: {
        userId: string;
        email: string;
        role: string;
        isVerified: boolean;
        profileStatus?: string;
      };
    }
  }
}

export const authenticate = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Access token is required',
      });
    }

    const token = authHeader.substring(7);
    const decoded = verifyAccessToken(token);

    req.authUser = {
      userId: decoded.userId,
      email: decoded.email,
      role: decoded.role,
      isVerified: decoded.isVerified,
      profileStatus: decoded.profileStatus,
    };

    next();
  } catch (error: any) {
    return res.status(401).json({
      success: false,
      message: 'Invalid or expired token',
      error: error.message,
    });
  }
};

export const authorize = (...allowedRoles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.authUser) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized',
      });
    }

    if (!allowedRoles.includes(req.authUser.role)) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to access this resource',
      });
    }

    next();
  };
};

export const requireCompleteProfile = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (!req.authUser) {
    return res.status(401).json({
      success: false,
      message: 'Unauthorized',
    });
  }

  if (req.authUser.role === 'MERCHANT') {
    if (req.authUser.profileStatus === 'INCOMPLETE') {
      return res.status(403).json({
        success: false,
        message: 'Please complete your profile before accessing this resource.',
        requiresAction: 'COMPLETE_PROFILE',
      });
    }
  }

  next();
};

export const requireVerification = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (!req.authUser) {
    return res.status(401).json({
      success: false,
      message: 'Unauthorized',
    });
  }

  if (req.authUser.role === 'MERCHANT') {
    if (req.authUser.profileStatus === 'INCOMPLETE') {
      return res.status(403).json({
        success: false,
        message: 'Please complete your profile first.',
        requiresAction: 'COMPLETE_PROFILE',
        profileStatus: 'INCOMPLETE',
      });
    }

    if (req.authUser.profileStatus === 'PENDING_VERIFICATION') {
      return res.status(403).json({
        success: false,
        message: 'Your profile is pending admin verification. Please wait for approval.',
        requiresAction: 'WAIT_FOR_VERIFICATION',
        profileStatus: 'PENDING_VERIFICATION',
      });
    }

    if (req.authUser.profileStatus === 'REJECTED') {
      return res.status(403).json({
        success: false,
        message: 'Your profile was rejected. Please update and resubmit.',
        requiresAction: 'RESUBMIT_PROFILE',
        profileStatus: 'REJECTED',
      });
    }

    if (req.authUser.profileStatus !== 'VERIFIED') {
      return res.status(403).json({
        success: false,
        message: 'Your merchant account is not verified yet.',
        profileStatus: req.authUser.profileStatus,
      });
    }
  }

  next();
};