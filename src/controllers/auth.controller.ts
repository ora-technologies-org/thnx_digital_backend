import { Request, Response } from "express";
import bcrypt from "bcrypt";
import { PrismaClient } from "@prisma/client";
import { changePasswordSchema, loginSchema } from "../validators/auth.validator";
import { generateTokens, verifyRefreshToken } from "../utils/jwt.util";
import { sendForgotPasswordOTP } from "../utils/email.util";
import { otpGenerator } from "../helpers/otp/otpGenerator";
import { OAuth2Client } from "google-auth-library";
import { ActivityLogger } from "../services/activityLog.service";

const prisma = new PrismaClient();
const googleVerification = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
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


export const googleLogin = async (req: Request, res: Response) => {
  try {
    const { credential } = req.body;

    if (!credential) {
      return res.status(400).json({
        success: false,
        message: "Google credential is required",
      });
    }

    const ticket = await googleVerification.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();

    if (!payload || !payload.email) {
      return res.status(400).json({
        success: false,
        message: "Invalid Google token",
      });
    }


    const { email, name, picture, sub: googleId } = payload;

    let user = await prisma.user.findUnique({
      where: { email },
      include: { merchantProfile: true },
    });

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    if (!user) {
      user = await prisma.user.create({
        data: {
          email,
          name: name ?? "Google User",
          googleId,
          provider: "google",
          role: "MERCHANT",
          emailVerified: true,
          lastLogin: new Date(),
        },
        include:{
          merchantProfile: true
        }
      });
    } else {
      user = await prisma.user.update({
        where: { email },
        data: {
          googleId,
          provider: "google",
          lastLogin: new Date(),
        },
        include: { merchantProfile: true },
      });
      if (user.isActive === false){
        return res.status(400).json({
          success: false,
          message: "Your account has been deactivated. Please contact support."
        })
      }
    }

    const profileStatus =
      user.merchantProfile?.profileStatus ?? "INCOMPLETE";


    const tokens = generateTokens({
      userId: user.id,
      email: user.email,
      role: user.role,
      isVerified: user.emailVerified,
      profileStatus,
    });


    await prisma.refreshToken.create({
      data: {
        userId: user.id,
        token: tokens.refreshToken,
        expiresAt,
      },
    });


    return res.status(200).json({
      success: true,
      message: "Google login successful",
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
    console.error("Google login error:", error);
    return res.status(500).json({
      success: false,
      message: "Google signup/login failed",
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
    
    if (storedToken?.user.isActive === false){
      return res.status(400).json({
        success: false,
        message: "User is deactivated, therefore couldn't rotate token."
      })
    }

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

export const getOtp = async(req: Request, res: Response) => {
  try {
    const email = req.body.email;
    if (!email){
      return res.status(400).json({
        success: false,
        message: "Email is required to change the password",
      })
    }
    const user = await prisma.user.findUnique({
      where: {
        email: email
      }
    });
    if (!user){
      return res.status(404).json({
        success: false,
        message: "No user found"
      });
    }
    const userOtp = await otpGenerator(3);
    try {
      await sendForgotPasswordOTP(
        user.email,
        user.name,
        userOtp.otp
      )
    } catch (error) {
      console.log(error)
      return res.status(500).json({
        success: false,
        message: "The mail couldn't be sent."
      })
    }
    const seedOtp = await prisma.changePassword.create({
      data:{
        userId: user.id,
        otpToken: userOtp.otp,
        otpExpiry: userOtp.otpExpiry,
        used: false
      }
    })
    if (!seedOtp){
      return res.status(400).json({
        success: false,
        message: "Failed to create otp. Please try again."
      })
    }
    return res.status(200).json({
      success: true,
      message: "Forgot Password OTP has been sent to your email."
    })

  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: "Error fetching user data",
      error: error.message,
    });
  }
}

export const verifyOtp = async (req: Request, res: Response) => {
  try {
    const { email, otp } = req.body;
    if (!email && !otp){
      return res.status(400).json({
        success: false,
        message: "Email and otp are required to verify the password."
      })
    }
    const user = await prisma.user.findUnique({
      where: {
        email: email
      }
    });

    if (!user){
      return res.status(404).json({
        success: false,
        message: "User not found with provieded email"
      });
    }

    const userOtp = await prisma.changePassword.findFirst({
      where:{
        userId: user.id
      },orderBy:{
        createdAt: "desc"
      }
    })
    if (!userOtp){
      return res.status(404).json({
        success: false,
        message: "OTP not found, please try requesting for otp once again."
      })
    }
    if (userOtp?.otpToken !== otp){
      return res.status(400).json({
        success: false, 
        message: "The provided otp is invalid."
      });
    }
    if (userOtp?.otpExpiry! < new Date() ){
      return res.status(400).json({
        success: false,
        message: "The provided otp has been expired."
      })
    }
    return res.status(200).json({
      success: true,
      message: "OTP has been verified successfully."
    })
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: "Error verifying otp",
      error: error.message
    })
  }
}


export const changePassword =  async (req: Request, res: Response) => {
  try {
    const parsedData = changePasswordSchema.safeParse(req.body);

    if (!parsedData.success) {
      const errors = parsedData.error.issues.map((issue) => ({
        field: issue.path[0],
        message: issue.message,
      }));

      return res.status(400).json({
        success: false,
        errors,
      });
    }
    const {email, password, otp, confirmPassword} = parsedData.data;
    
    if (!email || !password || !confirmPassword || !otp){
      return res.status(400).json({
        success: false,
        message: "Email, otp, Password and confirmPassword required for password change."
      });
    }

    const user = await prisma.user.findFirst({
      where: { email }
    });

    const otpDetails = await prisma.changePassword.findFirst({
      where:{
        userId: user?.id
      },
      orderBy:{
        createdAt: "desc"
      }
    })

    if (!user){
      return res.status(404).json({
        success: false,
        message: "User not found with the given email"
      });
    }
    if (otp !== otpDetails?.otpToken){
      return res.status(400).json({
        success: false,
        otp: "The provided otp is invalid"
      });
    }

    if (otpDetails?.otpExpiry! < new Date() ){
      return res.status(400).json({
        success: false,
        message: "The provided otp has been expired."
      })
    }
  
    if (password !== confirmPassword){
      return res.status(400).json({
        success: false,
        message: "Passwords do not match."
      });
    }

    const hashPassword = await bcrypt.hash(confirmPassword, 10);

    const updatePassword = await prisma.user.update({
      where: {
        email
      },
      data:{
        password: hashPassword
      }
    });
    if (!updatePassword){
      return res.status(400).json({
        success: false,
        message: "Password coudln't be changed. Please try again."
      });
    }
    return res.status(200).json({
      success: true,
      message: "Password changed successfully."
    })
  } catch (error: any) {
    console.log(error);
    return res.status(500).json({
      success: false,
      message: "Error changing your password",
      error: error.message
    })
  }
}
