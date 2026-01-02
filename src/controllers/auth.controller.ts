import { Request, Response, urlencoded } from "express";
import bcrypt from "bcrypt";
import { PrismaClient } from "@prisma/client";
import { changePasswordSchema, loginSchema } from "../validators/auth.validator";
import { generateTokens, verifyRefreshToken } from "../utils/jwt.util";
import { sendForgotPasswordOTP } from "../utils/email.util";
import { otpGenerator } from "../helpers/otp/otpGenerator";
import { ClientAuthentication, OAuth2Client } from "google-auth-library";
import { ActivityLogger } from "../services/activityLog.service";
import { STATUS_CODES } from "../utils/status_code";
import { compareRefreshToken, hashedRefreshToken } from "../utils/hashingTokens.util";
import { doesNotMatch } from "assert";
import { decode } from "punycode";

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
    
    const hashRefreshToken = await hashedRefreshToken(tokens.refreshToken);    

    const createRefreshtoken = await prisma.refreshToken.create({
      data: {
        token: hashRefreshToken,
        userId: user.id,
        expiresAt,
      },
    });

    console.log(createRefreshtoken);

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
        tokens
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

    const hashToken = await hashedRefreshToken(tokens.refreshToken);

    const createRefreshtoken = await prisma.refreshToken.create({
      data: {
        userId: user.id,
        token: hashToken,
        expiresAt,
      },
    });

    console.log(createRefreshtoken);
    

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
    const userId = req.authUser?.userId;

    if (!refreshToken) {
      return res.status(400).json({
        success: false,
        message: "Refresh token is required to continue the session.",
      });
    };
    
    const decoded = verifyRefreshToken(refreshToken);

    const storedToken = await prisma.refreshToken.findMany({
      where: { userId: userId },
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
      return res.status(STATUS_CODES.NOT_FOUND).json({
        success: false,
        message: "No active token found. Please log in again.",
      });
    }

    let matchedToken;

    for (const dbToken of storedToken) {
      if (await compareRefreshToken(refreshToken, dbToken.token)) {
        matchedToken = dbToken;
        break;
      }
    }

    if (!matchedToken){
      return res.status(STATUS_CODES.UNAUTHORIZED).json({
        success: false,
        message: "Token is no longer valid. Please log in again."
      })
    }


    const compareToken = await compareRefreshToken(refreshToken, matchedToken?.token);
  
    if (!compareToken){
      return res.status(STATUS_CODES.UNAUTHORIZED).json({
        success: false,
        message: "The provided token does not match."
      });
    }

    if (new Date() > matchedToken.expiresAt) {
      await prisma.refreshToken.delete({
        where: { id: matchedToken.id },
      });

      return res.status(401).json({
        success: false,
        message: "Refresh token expired",
      });
    }

    const tokens = generateTokens({
      userId: matchedToken.user.id,
      email: matchedToken.user.email,
      role: matchedToken.user.role,
      isVerified: matchedToken.user.merchantProfile?.isVerified || false,
      profileStatus: matchedToken.user.merchantProfile?.profileStatus,
    });

    await prisma.refreshToken.delete({
      where: { id: matchedToken.id },
    });

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const tokenHash = await hashedRefreshToken(tokens.refreshToken);

    await prisma.refreshToken.create({
      data: {
        token: tokenHash,
        userId: matchedToken.user.id,
        expiresAt,
      },
    });

    return res.status(200).json({
      success: true,
      message: "Token refreshed successfully",
      data: {
        tokens
      },
    });
  } catch (error: any) {
    console.error("Refresh token error:", error);
    return res.status(401).json({
      success: false,
      message: "Invalid or expired refresh token",
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
    });
  }
};

export const getOtp = async(req: Request, res: Response) => {
  try {
    const email = req.body.email;
    if (!email){
      return res.status(400).json({
        success: false,
        message: "Email is required to request a password reset OTP.",
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
        message: "If an account exists, an OTP has been sent."
      });
    }
    const userOtp = await otpGenerator(3);
    const hashOTP = await bcrypt.hash(userOtp.otp, 10);
    try {
      const sendOtp = await sendForgotPasswordOTP(
        user.email,
        userOtp.otp
      );
    } catch (error) {
      console.log(error)
      return res.status(500).json({
        success: false,
        message: "Failed to send OTP email. Please try again later."
      })
    }
    const seedOtp = await prisma.changePassword.create({
      data:{
        userId: user.id,
        otpToken: hashOTP,
        otpExpiry: userOtp.otpExpiry,
        used: false
      }
    })
    if (!seedOtp){
      return res.status(400).json({
        success: false,
        message: "Could not generate OTP. Please try again."
      })
    }
    return res.status(200).json({
      success: true,
      message: "An OTP has been sent to your email for password reset."
    })

  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: "An error occurred while processing your request.",
    });
  }
}

export const verifyOtp = async (req: Request, res: Response) => {
  try {
    const { email, otp } = req.body;
    if (!email && !otp){
      return res.status(400).json({
        success: false,
        message: "Both email and OTP are required for verification."
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
        message: "If an account exists, an OTP has been sent."
      });
    }

    const userOtp = await prisma.changePassword.findFirst({
      where:{
        userId: user.id
      },orderBy:{
        createdAt: "desc"
      }
    });
    
    if (!userOtp){
      return res.status(404).json({
        success: false,
        message: "OTP not found. Please request a new one."
      })
    }

    if (userOtp.used === true){
      return res.status(STATUS_CODES.BAD_REQUEST).json({
        success: false,
        message: "The provided OTP has been already used."
      });
    }

    const compareOTP = await bcrypt.compare(otp, userOtp.otpToken);

    if (!compareOTP){
      return res.status(400).json({
        success: false, 
        message: "The provided OTP is invalid."
      });
    }

    if (userOtp?.otpExpiry! < new Date() ){
      return res.status(400).json({
        success: false,
        message: "The provided OTP has expired. Please request a new one."
      })
    }
    return res.status(200).json({
      success: true,
      message: "OTP has been verified successfully."
    })
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: "An error occurred while verifying the OTP.",
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
        message: "Email, OTP, password, and confirmPassword are required."
      });
    }

    const user = await prisma.user.findFirst({
      where: { email }
    });
    if (!user){
      return res.status(400).json({
        success: false,
        message: "If an account exists, an OTP has been sent."
      })
    }
    const otpDetails = await prisma.changePassword.findFirst({
      where:{
        userId: user?.id
      },
      orderBy:{
        createdAt: "desc"
      }
    });

    if (!otpDetails){
      return res.status(STATUS_CODES.NOT_FOUND).json({
        success: false,
        message: "OTP details not found with given email."
      });
    }

    if (otpDetails.used === true){
      return res.status(STATUS_CODES.BAD_REQUEST).json({
        success: false,
        message: "The provided OTP has been already used."
      });
    };

    const compareOTP = await bcrypt.compare(otp, otpDetails?.otpToken);

    if (!compareOTP){
      return res.status(400).json({
        success: false,
        otp: "The provided OTP is invalid."
      });
    };

    if (otpDetails?.otpExpiry! < new Date() ){
      return res.status(400).json({
        success: false,
        message: "The provided OTP has expired. Please request a new one."
      })
    }
  
    if (password !== confirmPassword){
      return res.status(400).json({
        success: false,
        message: "Password and confirmPassword do not match."
      });
    }

    const hashPassword = await bcrypt.hash(confirmPassword, 10);

    const updatePassword = await prisma.user.update({
      where: {
        email
      },
      data:{
        password: hashPassword,
      }
    });
    if (!updatePassword){
      return res.status(400).json({
        success: false,
        message: "Failed to update password. Please try again."
      });
    }
    const used = await prisma.changePassword.update({
      where:{
        id: otpDetails.id
      },data:{
        used: true
      }
    });

    const revokeRefreshToken = await prisma.refreshToken.deleteMany({
      where:{
        userId: user.id
      }
    });

    return res.status(200).json({
      success: true,
      message: "Password has been updated successfully."
    })
  } catch (error: any) {
    console.log(error);
    return res.status(500).json({
      success: false,
      message: "An error occurred while changing the password.",
    })
  }
}
