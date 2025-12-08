import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import { PrismaClient } from '@prisma/client';
import {
  merchantQuickRegisterSchema,
  completeProfileSchema,
  loginSchema,
  adminCreateMerchantSchema,
} from '../validators/auth.validator';
import { generateTokens, verifyRefreshToken } from '../utils/jwt.util';
import { sendWelcomeEmail } from '../utils/email.util';

const prisma = new PrismaClient();

// Authenticated Request interface
interface AuthenticatedRequest extends Request {
  authUser?: {
    userId: string;
    email: string;
    role: string;
    isVerified: boolean;
    profileStatus?: string;
  };
}

/**
 * @route   POST /api/auth/merchant/register
 * @desc    Quick merchant registration (Step 1 - Minimal info)
 * @access  Public
 */
export const merchantRegister = async (req: Request, res: Response) => {
  try {
    const validatedData = merchantQuickRegisterSchema.parse(req.body);

    const existingUser = await prisma.user.findUnique({
      where: { email: validatedData.email },
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User with this email already exists',
      });
    }

    const hashedPassword = await bcrypt.hash(validatedData.password, 10);

    const user = await prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          email: validatedData.email,
          password: hashedPassword,
          name: validatedData.name,
          phone: validatedData.phone,
          role: 'MERCHANT',
          emailVerified: false,
          isActive: true,
        },
      });

      await tx.merchantProfile.create({
        data: {
          userId: newUser.id,
          businessName: validatedData.businessName,
          profileStatus: 'INCOMPLETE',
          isVerified: false,
        },
      });

      return newUser;
    });


       // Send welcome email with credentials
    await sendWelcomeEmail(
      user.email,
      user.name || 'Merchant',
      validatedData.password, // Send original password (before hashing)
      validatedData.businessName
    );
    

    const tokens = generateTokens({
      userId: user.id,
      email: user.email,
      role: user.role,
      isVerified: false,
      profileStatus: 'INCOMPLETE',
    });

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await prisma.refreshToken.create({
      data: {
        token: tokens.refreshToken,
        userId: user.id,
        expiresAt,
      },
    });

    return res.status(201).json({
      success: true,
      message: 'Registration successful! Please complete your profile to get verified.',
      data: {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          profileStatus: 'INCOMPLETE',
        },
        tokens,
      },
    });
  } catch (error: any) {
    console.error('Merchant registration error:', error);

    if (error.name === 'ZodError') {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.errors,
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message,
    });
  }
};

/**
 * @route   POST /api/auth/merchant/complete-profile
 * @desc    Complete merchant profile (Step 2 - Full details + documents)
 * @access  Merchant (Authenticated)
 */
export const completeProfile = async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const userId = authReq.authUser?.userId;
    const files = req.files as { [fieldname: string]: Express.Multer.File[] };

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized',
      });
    }

    if (authReq.authUser?.role !== 'MERCHANT') {
      return res.status(403).json({
        success: false,
        message: 'Only merchants can complete profile',
      });
    }

    const existingProfile = await prisma.merchantProfile.findUnique({
      where: { userId },
    });

    if (!existingProfile) {
      return res.status(404).json({
        success: false,
        message: 'Merchant profile not found',
      });
    }

    if (existingProfile.profileStatus === 'VERIFIED') {
      return res.status(400).json({
        success: false,
        message: 'Profile is already verified. Contact admin for changes.',
      });
    }

    const validatedData = completeProfileSchema.parse(req.body);

    if (!files?.identityDocument) {
      return res.status(400).json({
        success: false,
        message: 'Identity document is required',
      });
    }

    const documentData = {
      registrationDocument: files?.registrationDocument?.[0]?.path || null,
      taxDocument: files?.taxDocument?.[0]?.path || null,
      identityDocument: files?.identityDocument?.[0]?.path,
      additionalDocuments: files?.additionalDocuments?.map((f) => f.path) || [],
    };

    const updatedProfile = await prisma.merchantProfile.update({
      where: { userId },
      data: {
        businessRegistrationNumber: validatedData.businessRegistrationNumber,
        taxId: validatedData.taxId,
        businessType: validatedData.businessType,
        businessCategory: validatedData.businessCategory,
        address: validatedData.address,
        city: validatedData.city,
        state: validatedData.state,
        zipCode: validatedData.zipCode,
        country: validatedData.country,
        businessPhone: validatedData.businessPhone,
        businessEmail: validatedData.businessEmail,
        website: validatedData.website,
        description: validatedData.description,
        bankName: validatedData.bankName,
        accountNumber: validatedData.accountNumber,
        accountHolderName: validatedData.accountHolderName,
        ifscCode: validatedData.ifscCode,
        swiftCode: validatedData.swiftCode,
        registrationDocument: documentData.registrationDocument,
        taxDocument: documentData.taxDocument,
        identityDocument: documentData.identityDocument,
        additionalDocuments: documentData.additionalDocuments,
        profileStatus: 'PENDING_VERIFICATION',
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            role: true,
          },
        },
      },
    });

    const tokens = generateTokens({
      userId: userId,
      email: authReq.authUser!.email,
      role: authReq.authUser!.role,
      isVerified: false,
      profileStatus: 'PENDING_VERIFICATION',
    });

    return res.status(200).json({
      success: true,
      message: 'Profile submitted successfully! Waiting for admin verification.',
      data: {
        profile: updatedProfile,
        tokens,
      },
    });
  } catch (error: any) {
    console.error('Complete profile error:', error);

    if (error.name === 'ZodError') {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.errors,
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message,
    });
  }
};

/**
 * @route   POST /api/auth/login
 * @desc    Login user (Admin, Merchant, or User)
 * @access  Public
 */
export const login = async (req: Request, res: Response) => {
  try {
    const validatedData = loginSchema.parse(req.body);

    const user = await prisma.user.findUnique({
      where: { email: validatedData.email },
      include: {
        merchantProfile: {
          select: {
            profileStatus: true,
            isVerified: true,
          },
        },
      },
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password',
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: 'Your account has been deactivated. Contact support.',
      });
    }

    if (user.password) {
      const isPasswordValid = await bcrypt.compare(
        validatedData.password,
        user.password
      );

      if (!isPasswordValid) {
        return res.status(401).json({
          success: false,
          message: 'Invalid email or password',
        });
      }
    } else {
      return res.status(400).json({
        success: false,
        message: 'This account uses OAuth. Please login with Google.',
      });
    }

    const profileStatus = user.merchantProfile?.profileStatus || undefined;

    const tokens = generateTokens({
      userId: user.id,
      email: user.email,
      role: user.role,
      isVerified: user.merchantProfile?.isVerified || false,
      profileStatus,
    });

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await prisma.refreshToken.create({
      data: {
        token: tokens.refreshToken,
        userId: user.id,
        expiresAt,
      },
    });

    await prisma.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date() },
    });

    return res.status(200).json({
      success: true,
      message: 'Login successful',
      data: {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          profileStatus,
          isVerified: user.merchantProfile?.isVerified || false,
        },
        tokens,
      },
    });
  } catch (error: any) {
    console.error('Login error:', error);

    if (error.name === 'ZodError') {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.errors,
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message,
    });
  }
};

/**
 * @route   POST /api/auth/refresh
 * @desc    Refresh access token
 * @access  Public
 */
export const refreshToken = async (req: Request, res: Response) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({
        success: false,
        message: 'Refresh token is required',
      });
    }

    const decoded = verifyRefreshToken(refreshToken);

    const storedToken = await prisma.refreshToken.findUnique({
      where: { token: refreshToken },
      include: {
        user: {
          include: {
            merchantProfile: {
              select: {
                profileStatus: true,
                isVerified: true,
              },
            },
          },
        },
      },
    });

    if (!storedToken) {
      return res.status(401).json({
        success: false,
        message: 'Invalid refresh token',
      });
    }

    if (new Date() > storedToken.expiresAt) {
      await prisma.refreshToken.delete({
        where: { id: storedToken.id },
      });

      return res.status(401).json({
        success: false,
        message: 'Refresh token expired',
      });
    }

    const tokens = generateTokens({
      userId: storedToken.user.id,
      email: storedToken.user.email,
      role: storedToken.user.role,
      isVerified: storedToken.user.merchantProfile?.isVerified || false,
      profileStatus: storedToken.user.merchantProfile?.profileStatus,
    });

    await prisma.refreshToken.delete({
      where: { id: storedToken.id },
    });

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await prisma.refreshToken.create({
      data: {
        token: tokens.refreshToken,
        userId: storedToken.user.id,
        expiresAt,
      },
    });

    return res.status(200).json({
      success: true,
      message: 'Token refreshed successfully',
      data: {
        tokens,
      },
    });
  } catch (error: any) {
    console.error('Refresh token error:', error);
    return res.status(401).json({
      success: false,
      message: 'Invalid or expired refresh token',
      error: error.message,
    });
  }
};

/**
 * @route   POST /api/auth/logout
 * @desc    Logout user (invalidate refresh token)
 * @access  Public
 */
export const logout = async (req: Request, res: Response) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({
        success: false,
        message: 'Refresh token is required',
      });
    }

    await prisma.refreshToken.deleteMany({
      where: { token: refreshToken },
    });

    return res.status(200).json({
      success: true,
      message: 'Logout successful',
    });
  } catch (error: any) {
    console.error('Logout error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error during logout',
      error: error.message,
    });
  }
};

/**
 * @route   GET /api/auth/me
 * @desc    Get current user profile
 * @access  Private
 */
export const getCurrentUser = async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const userId = authReq.authUser?.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized',
      });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        role: true,
        avatar: true,
        bio: true,
        emailVerified: true,
        isActive: true,
        createdAt: true,
        lastLogin: true,
        merchantProfile: {
          select: {
            id: true,
            businessName: true,
            profileStatus: true,
            isVerified: true,
            verifiedAt: true,
            rejectionReason: true,
            rejectedAt: true,
            address: true,
            city: true,
            country: true,
            businessPhone: true,
            businessEmail: true,
            website: true,
            logo: true,
            description: true,
          },
        },
      },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    return res.status(200).json({
      success: true,
      data: { user },
    });
  } catch (error: any) {
    console.error('Get current user error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error fetching user data',
      error: error.message,
    });
  }
};

/**
 * @route   POST /api/auth/admin/create-merchant
 * @desc    Admin creates a merchant (auto-verified)
 * @access  Admin only
 */
export const adminCreateMerchant = async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const validatedData = adminCreateMerchantSchema.parse(req.body);
    const adminId = authReq.authUser?.userId;

    const existingUser = await prisma.user.findUnique({
      where: { email: validatedData.email },
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User with this email already exists',
      });
    }

    const hashedPassword = await bcrypt.hash(validatedData.password, 10);

    const user = await prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          email: validatedData.email,
          password: hashedPassword,
          name: validatedData.name,
          phone: validatedData.phone,
          role: 'MERCHANT',
          emailVerified: true,
          isActive: true,
          createdById: adminId,
        },
      });

      await tx.merchantProfile.create({
        data: {
          userId: newUser.id,
          businessName: validatedData.businessName,
          businessRegistrationNumber: validatedData.businessRegistrationNumber,
          taxId: validatedData.taxId,
          businessType: validatedData.businessType,
          businessCategory: validatedData.businessCategory,
          address: validatedData.address,
          city: validatedData.city,
          state: validatedData.state,
          zipCode: validatedData.zipCode,
          country: validatedData.country,
          businessPhone: validatedData.businessPhone,
          businessEmail: validatedData.businessEmail,
          website: validatedData.website,
          description: validatedData.description,
          profileStatus: 'VERIFIED',
          isVerified: true,
          verifiedAt: new Date(),
          verifiedById: adminId,
        },
      });

      return newUser;
    });


       // Send welcome email with credentials
    await sendWelcomeEmail(
      user.email,
      user.name || 'Merchant',
      validatedData.password, // Send original password (before hashing)
      validatedData.businessName
    );


    return res.status(201).json({
      success: true,
      message: 'Merchant created and verified successfully',
      data: {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        },
      },
    });
  } catch (error: any) {
    console.error('Admin create merchant error:', error);

    if (error.name === 'ZodError') {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.errors,
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message,
    });
  }
};

/**
 * @route   GET /api/auth/admin/merchants/pending
 * @desc    Get all pending merchant verifications
 * @access  Admin only
 */
export const getPendingMerchants = async (req: Request, res: Response) => {
  try {
    const pendingMerchants = await prisma.merchantProfile.findMany({
      where: {
        profileStatus: 'PENDING_VERIFICATION',
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            phone: true,
            createdAt: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return res.status(200).json({
      success: true,
      data: {
        merchants: pendingMerchants,
        count: pendingMerchants.length,
      },
    });
  } catch (error: any) {
    console.error('Get pending merchants error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error fetching pending merchants',
      error: error.message,
    });
  }
};

/**
 * @route   POST /api/auth/admin/merchants/:merchantId/verify
 * @desc    Admin verify or reject merchant
 * @access  Admin only
 */
export const verifyMerchant = async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const { merchantId } = req.params;
    const { action, rejectionReason, verificationNotes } = req.body;
    const adminId = authReq.authUser?.userId;

    if (!['approve', 'reject'].includes(action)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid action. Must be "approve" or "reject"',
      });
    }

    if (action === 'reject' && !rejectionReason) {
      return res.status(400).json({
        success: false,
        message: 'Rejection reason is required',
      });
    }

    const merchantProfile = await prisma.merchantProfile.findUnique({
      where: { userId: merchantId },
      include: {
        user: true,
      },
    });

    if (!merchantProfile) {
      return res.status(404).json({
        success: false,
        message: 'Merchant profile not found',
      });
    }

    if (merchantProfile.profileStatus === 'VERIFIED') {
      return res.status(400).json({
        success: false,
        message: 'Merchant is already verified',
      });
    }

    const updatedProfile = await prisma.merchantProfile.update({
      where: { userId: merchantId },
      data:
        action === 'approve'
          ? {
              profileStatus: 'VERIFIED',
              isVerified: true,
              verifiedAt: new Date(),
              verifiedById: adminId,
              verificationNotes,
              rejectionReason: null,
              rejectedAt: null,
            }
          : {
              profileStatus: 'REJECTED',
              isVerified: false,
              rejectionReason,
              rejectedAt: new Date(),
              verifiedById: adminId,
              verificationNotes,
            },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
      },
    });

    return res.status(200).json({
      success: true,
      message: `Merchant ${action === 'approve' ? 'approved' : 'rejected'} successfully`,
      data: {
        profile: updatedProfile,
      },
    });
  } catch (error: any) {
    console.error('Verify merchant error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error verifying merchant',
      error: error.message,
    });
  }
};

/**
 * @route   GET /api/auth/admin/merchants
 * @desc    Get all merchants
 * @access  Admin only
 */
export const getAllMerchants = async (req: Request, res: Response) => {
  try {
    const merchants = await prisma.merchantProfile.findMany({
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            phone: true,
            createdAt: true,
            isActive: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return res.status(200).json({
      success: true,
      data: {
        merchants,
        count: merchants.length,
      },
    });
  } catch (error: any) {
    console.error('Get all merchants error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error fetching merchants',
      error: error.message,
    });
  }
};