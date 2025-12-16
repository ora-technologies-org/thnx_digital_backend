import { Request, Response } from "express";
import bcrypt from "bcrypt";
import { PrismaClient } from "@prisma/client";
import { loginSchema } from "../validators/auth.validator";
import { generateTokens, verifyRefreshToken } from "../utils/jwt.util";
import { ActivityLogger } from "../services/activityLog.service";

const prisma = new PrismaClient();

// Authenticated Request interface
export interface AuthenticatedRequest extends Request {
  authUser?: {
    userId: string;
    email: string;
    role: string;
    isVerified: boolean;
    profileStatus?: string;
  };
}

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

      await ActivityLogger.loginFailed(validatedData.email, 'User not found', req);

      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    if (!user.isActive) {
      await ActivityLogger.loginFailed(validatedData.email, 'Account deactivated', req);

      return res.status(403).json({
        success: false,
        message: "Your account has been deactivated. Contact support.",
      });
    }

    if (user.password) {
      const isPasswordValid = await bcrypt.compare(
        validatedData.password,
        user.password,
      );

      if (!isPasswordValid) {
        await ActivityLogger.loginFailed(validatedData.email, 'Invalid password', req);
        return res.status(401).json({
          success: false,
          message: "Invalid email or password",
        });
      }
    } else {
      await ActivityLogger.loginFailed(validatedData.email, 'OAuth account attempted password login', req);
      return res.status(400).json({
        success: false,
        message: "This account uses OAuth. Please login with Google.",
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

    await ActivityLogger.login(user.id, user.role, req);


    return res.status(200).json({
      success: true,
      message: "Login successful",
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
    console.error("Login error:", error);

    if (error.name === "ZodError") {
      return res.status(400).json({
        success: false,
        message: "Validation error",
        errors: error.errors,
      });
    }

    return res.status(500).json({
      success: false,
      message: "Internal server error",
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
        message: "Refresh token is required",
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
        message: "Invalid refresh token",
      });
    }

    if (new Date() > storedToken.expiresAt) {
      await prisma.refreshToken.delete({
        where: { id: storedToken.id },
      });

      return res.status(401).json({
        success: false,
        message: "Refresh token expired",
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
      message: "Token refreshed successfully",
      data: {
        tokens,
      },
    });
  } catch (error: any) {
    console.error("Refresh token error:", error);
    return res.status(401).json({
      success: false,
      message: "Invalid or expired refresh token",
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
        message: "Refresh token is required",
      });
    }

    const tokenRecord = await prisma.refreshToken.findUnique({
      where: { token: refreshToken },
      include: { user: true }
    });


    await prisma.refreshToken.deleteMany({
      where: { token: refreshToken },
    });

    if (tokenRecord?.user) {
      await ActivityLogger.logout(tokenRecord.user.id, tokenRecord.user.role, req);
    }


    return res.status(200).json({
      success: true,
      message: "Logout successful",
    });
  } catch (error: any) {
    console.error("Logout error:", error);
    return res.status(500).json({
      success: false,
      message: "Error during logout",
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
        message: "Unauthorized",
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
        message: "User not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: { user },
    });
  } catch (error: any) {
    console.error("Get current user error:", error);
    return res.status(500).json({
      success: false,
      message: "Error fetching user data",
      error: error.message,
    });
  }
};
