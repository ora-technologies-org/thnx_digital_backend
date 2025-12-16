import { NextFunction, Request, Response } from "express";
import prisma from "../utils/prisma.util";
import {
  adminCreateMerchantSchema,
  completeProfileSchema,
  merchantQuickRegisterSchema,
} from "../validators/auth.validator";
import { sendWelcomeEmail } from "../utils/email.util";
import { AuthenticatedRequest } from "./auth.controller";
import bcrypt from "bcrypt";
import { generateTokens } from "../utils/jwt.util";
import { date } from "zod";

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
        message: "User with this email already exists",
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
          role: "MERCHANT",
          emailVerified: false,
          isActive: true,
        },
      });

      // await tx.merchantProfile.create({
      //   data: {
      //     userId: newUser.id,
      //     businessName: validatedData.businessName,
      //     profileStatus: "INCOMPLETE",
      //     isVerified: false,
      //   },
      // });

      return newUser;
    });

    // Send welcome email with credentials
    await sendWelcomeEmail(
      user.email,
      user.name || "Merchant",
      validatedData.password, // Send original password (before hashing)
      // validatedData.businessName,
    );

    const tokens = generateTokens({
      userId: user.id,
      email: user.email,
      role: user.role,
      isVerified: false,
      profileStatus: "INCOMPLETE",
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
      message:
        "Registration successful! Please complete your profile to get verified.",
      data: {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          profileStatus: "INCOMPLETE",
        },
        tokens,
      },
    });
  } catch (error: any) {
    console.error("Merchant registration error:", error);
    
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
        message: "Unauthorized",
      });
    }

    if (authReq.authUser?.role !== "MERCHANT") {
      return res.status(403).json({
        success: false,
        message: "Only merchants can complete profile",
      });
    }

    const merchant = await prisma.merchantProfile.findUnique({
      where:{
        userId: userId
      }
    }); 
    if (merchant?.profileStatus === "VERIFIED"){
      return res.status(400).json({
        success: false,
        message: "Profile already verified."
      })
    }

    const validatedData = completeProfileSchema.parse(req.body);

    if (!files?.identityDocument) {
      return res.status(400).json({
        success: false,
        message: "Identity document is required",
      });
    }

    const documentData = {
      registrationDocument: files?.registrationDocument?.[0]?.path || null,
      taxDocument: files?.taxDocument?.[0]?.path || null,
      identityDocument: files?.identityDocument?.[0]?.path,
      additionalDocuments: files?.additionalDocuments?.map((f) => f.path) || [],
    };

    const updatedProfile = await prisma.merchantProfile.create({
      data: {
        businessName: validatedData.businessName!,
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
        profileStatus: "PENDING_VERIFICATION",
        userId: userId
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
      profileStatus: "PENDING_VERIFICATION",
    });

    return res.status(200).json({
      success: true,
      message:
        "Profile submitted successfully! Waiting for admin verification.",
      data: {
        profile: updatedProfile,
        tokens,
      },
    });
  } catch (error: any) {
    console.error("Complete profile error:", error);

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
 * @route   GET /api/merchant/profile
 * @desc    Get merchant's own profile with full details
 * @access  Merchant
 */
export const getMerchantProfile = async (req: Request, res: Response) => {
  try {
    // const userId = req.user?.id;
    const userId = "1";

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    // Get merchant profile with user details
    const merchantProfile = await prisma.merchantProfile.findUnique({
      where: { userId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            phone: true,
            avatar: true,
            bio: true,
            role: true,
            emailVerified: true,
            createdAt: true,
            lastLogin: true,
          },
        },
        verifiedBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    if (!merchantProfile) {
      return res.status(404).json({
        success: false,
        message: "Merchant profile not found",
      });
    }

    // Determine completion percentage
    const requiredFields = [
      "businessName",
      "address",
      "city",
      "country",
      "businessPhone",
      "businessEmail",
      "bankName",
      "accountNumber",
      "accountHolderName",
      "identityDocument",
    ];

    const filledFields = requiredFields.filter(
      (field) => merchantProfile[field as keyof typeof merchantProfile],
    );
    const completionPercentage = Math.round(
      (filledFields.length / requiredFields.length) * 100,
    );

    // Check what's missing
    const missingFields = requiredFields.filter(
      (field) => !merchantProfile[field as keyof typeof merchantProfile],
    );

    return res.status(200).json({
      success: true,
      data: {
        profile: merchantProfile,
        stats: {
          completionPercentage,
          missingFields,
          isComplete: merchantProfile.profileStatus !== "INCOMPLETE",
          isPending: merchantProfile.profileStatus === "PENDING_VERIFICATION",
          isVerified: merchantProfile.profileStatus === "VERIFIED",
          isRejected: merchantProfile.profileStatus === "REJECTED",
        },
      },
    });
  } catch (error: any) {
    console.error("Get merchant profile error:", error);
    return res.status(500).json({
      success: false,
      message: "Error fetching merchant profile",
      error: error.message,
    });
  }
};

/**
 * @route   POST /api/merchant/resubmit
 * @desc    Resubmit profile after rejection (with updated info & documents)
 * @access  Merchant (Rejected status only)
 */
export const resubmitProfile = async (req: Request, res: Response) => {
  try {
    // const userId = req.user?.id;
    const userId = "1";
    const files = req.files as { [fieldname: string]: Express.Multer.File[] };

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    // Get existing merchant profile
    const existingProfile = await prisma.merchantProfile.findUnique({
      where: { userId },
    });

    if (!existingProfile) {
      return res.status(404).json({
        success: false,
        message: "Merchant profile not found",
      });
    }

    // Only allow resubmission if profile is rejected
    if (existingProfile.profileStatus !== "REJECTED") {
      return res.status(400).json({
        success: false,
        message: `Cannot resubmit profile. Current status: ${existingProfile.profileStatus}`,
        profileStatus: existingProfile.profileStatus,
      });
    }

    // Validate request body
    const validatedData = completeProfileSchema.parse(req.body);

    // Prepare document URLs (keep old ones if new ones not uploaded)
    const documentData = {
      registrationDocument:
        files?.registrationDocument?.[0]?.path ||
        existingProfile.registrationDocument,
      taxDocument: files?.taxDocument?.[0]?.path || existingProfile.taxDocument,
      identityDocument:
        files?.identityDocument?.[0]?.path || existingProfile.identityDocument,
      additionalDocuments: files?.additionalDocuments
        ? files.additionalDocuments.map((f) => f.path)
        : existingProfile.additionalDocuments,
    };

    // Ensure identity document is present
    if (!documentData.identityDocument) {
      return res.status(400).json({
        success: false,
        message: "Identity document is required",
      });
    }

    // Update merchant profile
    const updatedProfile = await prisma.merchantProfile.update({
      where: { userId },
      data: {
        // Business Information
        businessRegistrationNumber: validatedData.businessRegistrationNumber,
        taxId: validatedData.taxId,
        businessType: validatedData.businessType,
        businessCategory: validatedData.businessCategory,

        // Business Address
        address: validatedData.address,
        city: validatedData.city,
        state: validatedData.state,
        zipCode: validatedData.zipCode,
        country: validatedData.country,

        // Business Contact
        businessPhone: validatedData.businessPhone,
        businessEmail: validatedData.businessEmail,
        website: validatedData.website,
        description: validatedData.description,

        // Bank Details
        bankName: validatedData.bankName,
        accountNumber: validatedData.accountNumber,
        accountHolderName: validatedData.accountHolderName,
        ifscCode: validatedData.ifscCode,
        swiftCode: validatedData.swiftCode,

        // Documents
        registrationDocument: documentData.registrationDocument,
        taxDocument: documentData.taxDocument,
        identityDocument: documentData.identityDocument,
        additionalDocuments: documentData.additionalDocuments ?? undefined,

        // Clear rejection info and update status
        profileStatus: "PENDING_VERIFICATION",
        rejectionReason: null,
        rejectedAt: null,

        // Clear verification info (will be set again by admin)
        verifiedAt: null,
        verifiedById: null,
        verificationNotes: null,
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

    return res.status(200).json({
      success: true,
      message:
        "Profile resubmitted successfully! Waiting for admin verification.",
      data: {
        profile: updatedProfile,
      },
    });
  } catch (error: any) {
    console.error("Resubmit profile error:", error);

    if (error.name === "ZodError") {
      return res.status(400).json({
        success: false,
        message: "Validation error",
        errors: error.errors,
      });
    }

    return res.status(500).json({
      success: false,
      message: "Error resubmitting profile",
      error: error.message,
    });
  }
};

/**
 * @route   PUT /api/merchant/profile
 * @desc    Update non-critical merchant profile fields (bio, avatar, description)
 * @access  Merchant (Profile complete)
 */
export const updateMerchantProfile = async (req: Request, res: Response) => {
  try {
    const userId = req.authUser?.userId;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    // Only allow updating these non-critical fields
    const allowedUpdates = {
      description: req.body.description,
      website: req.body.website,
      logo: req.body.logo,
    };

    // Remove undefined values
    const updates = Object.fromEntries(
      Object.entries(allowedUpdates).filter(([_, v]) => v !== undefined),
    );

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        success: false,
        message: "No valid fields to update",
      });
    }

    // Update merchant profile
    const updatedProfile = await prisma.merchantProfile.update({
      where: { userId },
      data: updates,
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

    return res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      data: {
        profile: updatedProfile,
      },
    });
  } catch (error: any) {
    console.error("Update profile error:", error);
    return res.status(500).json({
      success: false,
      message: "Error updating profile",
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
    const files = req.files as { [fieldname: string]: Express.Multer.File[] };

    const existingUser = await prisma.user.findUnique({
      where: { email: validatedData.email },
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "User with this email already exists",
      });
    }

    const existsRegistrationNumber = await prisma.merchantProfile.findFirst({
      where: {
        businessRegistrationNumber: validatedData.businessRegistrationNumber
      }
    })

    if (existsRegistrationNumber){
      return res.status(400).json({
        success: false,
        message: "Provided business registration number is already in use"
      })
    }

    const documentData = {
        registrationDocument: files?.registrationDocument?.[0]?.path || null,
        taxDocument: files?.taxDocument?.[0]?.path || null,
        identityDocument: files?.identityDocument?.[0]?.path,
        additionalDocuments: files?.additionalDocuments?.map((f) => f.path) || [],
    };

    const hashedPassword = await bcrypt.hash(validatedData.password, 10);

    const user = await prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          email: validatedData.email,
          password: hashedPassword,
          name: validatedData.name,
          phone: validatedData.phone,
          role: "MERCHANT",
          emailVerified: true,
          isActive: true,
          createdById: adminId,
          isFirstTime: true
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
          profileStatus: "VERIFIED",
          isVerified: true,
          verifiedAt: new Date(),
          verifiedById: adminId,
          bankName: validatedData.bankName,
          accountNumber: validatedData.accountNumber,
          accountHolderName: validatedData.accountHolderName,
          ifscCode: validatedData.ifscCode,
          swiftCode: validatedData.swiftCode,
          taxDocument: documentData.taxDocument,
          identityDocument: documentData.identityDocument,
          additionalDocuments: documentData.additionalDocuments,
          registrationDocument: documentData.registrationDocument,
        },
      });

      return newUser;
    });

    // Send welcome email with credentials
    await sendWelcomeEmail(
      user.email,
      user.name || "Merchant",
      validatedData.password, // Send original password (before hashing)
      validatedData.businessName,
    );

    return res.status(201).json({
      success: true,
      message: "Merchant created and verified successfully",
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
    console.error("Admin create merchant error:", error);

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
 * @route   GET /api/auth/merchants/:merchantId
 * @desc    Update merchant api's
 * @access  Admin only
 */

export const adminUpdateMerchant = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { merchantId } = req.params;
    const files = req.files as {
      registrationDocument?: Express.Multer.File[];
      taxDocument?: Express.Multer.File[];
      identityDocument?: Express.Multer.File[];
      additionalDocuments?: Express.Multer.File[];
    };


    const updateData: Record<string, any> = {};
    const allowedFileds = ["businessName", "businessRegistrationNumber", "taxId", "businessType", "businessCategory", "address", "city", "state", "zipCode", "country", "businessPhone", "businessEmail", "website", "bankName", "accountNumber", "accountHolderName", "ifscCode", "swiftCode", "description", "registrationDocument", "taxDocument", "identityDocument", "additionalDocuments", "giftCardLimit"];
    
    const sentFields = Object.keys(req.body);
    const invalidFields = sentFields.filter((field) => !allowedFileds.includes(field));
    
    if (invalidFields.length > 0){
      return res.status(400).json({
        success: false,
        message: `You cannot update the following fields: ${invalidFields.join(" ,")}`
      })
    }

    for (const field of allowedFileds){
      if (req.body[field] !== undefined){
        updateData[field] = req.body[field]
      }
    }

    const merchant = await prisma.merchantProfile.findFirst({
      where:{
        id: merchantId
      }
    });

    if (files?.registrationDocument?.[0]) {
      updateData.registrationDocument =
        files.registrationDocument[0].path;
    }

    if (files?.taxDocument?.[0]) {
      updateData.taxDocument = files.taxDocument[0].path;
    }

    if (files?.identityDocument?.[0]) {
      updateData.identityDocument = files.identityDocument[0].path;
    }

    if (files?.additionalDocuments?.length) {
      updateData.additionalDocuments = files.additionalDocuments.map(
        (f) => f.path
      );
    }

    if (updateData.giftCardLimit){
      updateData.giftCardLimit = Number(updateData.giftCardLimit)
    };
    if (merchant?.profileStatus === "VERIFIED"){
        updateData.profileStatus = "VERIFIED";
        const updateMerchant = await prisma.merchantProfile.update({
        where:{
          id: merchantId
        },
        data: updateData
      })
      if (!updateMerchant){
        return res.status(400).json({
          success: true,
          message: "Your profile couldn't be updated"
        });
      }
      return res.status(200).json({
        success :true,
        message: "Profile updated successfully.",
        data: updateMerchant
      })
    }else{
      return res.status(200).json({
        success :false,
        message: "This merchant profile cannot be updated at its current status.",
      })
    }

  } catch (error: any) {
    next(error);
  }
}

/**
 * @route   GET /api/auth/admin/merchants/pending
 * @desc    Get all pending merchant verifications
 * @access  Admin only
 */
export const getPendingMerchants = async (req: Request, res: Response) => {
  try {
    const { search, sort = "desc" } = req.query;

    const whereClause: any = {
      profileStatus: "PENDING_VERIFICATION",
    };
    if (search) {
      whereClause.OR = [
        {
          businessName: {
            contains: search as string,
            mode: "insensitive",
          },
        },
        {
          user: {
            email: {
              contains: search as string,
              mode: "insensitive",
            },
          },
        },
      ];
    }


    const pendingMerchants = await prisma.merchantProfile.findMany({
      where: whereClause,
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
        createdAt: sort === "asc" ? "asc" : "desc",
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
    console.error("Get pending merchants error:", error);
    return res.status(500).json({
      success: false,
      message: "Error fetching pending merchants",
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

    if (!["approve", "reject"].includes(action)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid action. Must be "approve" or "reject"',
      });
    }

    if (action === "reject" && !rejectionReason) {
      return res.status(400).json({
        success: false,
        message: "Rejection reason is required",
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
        message: "Merchant profile not found",
      });
    }

    if (merchantProfile.profileStatus === "VERIFIED") {
      return res.status(400).json({
        success: false,
        message: "Merchant is already verified",
      });
    }

    const updatedProfile = await prisma.merchantProfile.update({
      where: { userId: merchantId },
      data:
        action === "approve"
          ? {
              profileStatus: "VERIFIED",
              isVerified: true,
              verifiedAt: new Date(),
              verifiedById: adminId,
              verificationNotes,
              rejectionReason: null,
              rejectedAt: null,
            }
          : {
              profileStatus: "REJECTED",
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
      message: `Merchant ${action === "approve" ? "approved" : "rejected"} successfully`,
      data: {
        profile: updatedProfile,
      },
    });
  } catch (error: any) {
    console.error("Verify merchant error:", error);
    return res.status(500).json({
      success: false,
      message: "Error verifying merchant",
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
    const { 
      profileStatus, 
      active, 
      sort = "desc", 
      createdBy,
      search 
    } = req.query;

    const whereClause: any = {};

    if (profileStatus) {
      whereClause.profileStatus = profileStatus as string;
    }

    if (active !== undefined) {
      whereClause.user = {
        isActive: active === "true",
      };
    }

    if (createdBy) {
      whereClause.userId = createdBy as string;
    }

    if (search) {
      whereClause.businessName = {
        contains: search as string,
        mode: "insensitive",
      };
    }

    const merchants = await prisma.merchantProfile.findMany({
      where: whereClause,
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
        createdAt: sort === "asc" ? "asc" : "desc",
      },
    });

    const countWhereClause: any = { ...whereClause };
    delete countWhereClause.profileStatus;

    const statusCounts = await prisma.merchantProfile.groupBy({
      by: ["profileStatus"],
      where: countWhereClause,
      _count: {
        profileStatus: true,
      },
    });

    const counts = {
      PENDING_VERIFICATION: 0,
      VERIFIED: 0,
      REJECTED: 0,
      INCOMPLETE: 0,
    };

    statusCounts.forEach((item) => {
      counts[item.profileStatus] = item._count.profileStatus;
    });

    return res.status(200).json({
      success: true,
      data: {
        count: merchants.length,
        statusCounts: counts,
        merchants,
      },
    });
  } catch (error: any) {
    console.error("Get all merchants error:", error);
    return res.status(500).json({
      success: false,
      message: "Error fetching merchants",
      error: error.message,
    });
  }
};

export const getMerchantById = async (req: Request, res: Response) => {
  try {
    const { merchantId } = req.params;
    console.log(merchantId);
    const merchant = await prisma.merchantProfile.findUnique({
      where:{
        id: merchantId
      },include:{
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            phone: true,
            role: true,
            isActive: true,
            provider: true,
            avatar: true,
            bio: true,
            emailVerified: true,
            lastLogin: true,
            createdAt: true,
            updatedAt: true

          }
        }
      }
    });
    // const {password, ...merchantData} = merchant?.user
    if (!merchant){
      return res.status(404).json({
        success: false,
        message: "Merchant not found with the given id."
      })
    }
    return res.status(200).json({
      success: true,
      message: "Merchant fetched successfully",
      data: merchant
    });

  } catch (error: any) {
    console.error("Get all merchants error:", error);
    return res.status(500).json({
      success: false,
      message: "Error fetching merchants",
      error: error.message,
    });
  }
}

/**
 * @route   DELETE /api/auth/admin/merchants/:merchantId
 * @desc    Admin delete merchant (soft delete or hard delete)
 * @access  Admin only
 */
export const deleteMerchant = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const { merchantId } = req.params;
    const { hardDelete = false } = req.body; // Optional: permanently delete

    const merchantProfile = await prisma.merchantProfile.findUnique({
      where: { userId: merchantId },
      include: {
        user: true,
      },
    });

    if (!merchantProfile) {
      return res.status(404).json({
        success: false,
        message: "Merchant not found",
      });
    }

    if (hardDelete) {
      // Permanently delete merchant and user
      await prisma.$transaction(async (tx) => {
        // Delete refresh tokens
        await tx.refreshToken.deleteMany({
          where: { userId: merchantId },
        });

        // Delete merchant profile
        await tx.merchantProfile.delete({
          where: { userId: merchantId },
        });

        // Delete user
        await tx.user.delete({
          where: { id: merchantId },
        });
      });

      return res.status(200).json({
        success: true,
        message: "Merchant permanently deleted",
      });
    } else {
      // Soft delete - deactivate the user
      await prisma.user.update({
        where: { id: merchantId },
        data: { isActive: false },
      });

      // Invalidate all refresh tokens
      await prisma.refreshToken.deleteMany({
        where: { userId: merchantId },
      });

      return res.status(200).json({
        success: true,
        message: "Merchant deactivated successfully",
        data: {
          merchantId,
          email: merchantProfile.user.email,
        },
      });
    }
  } catch (error: any) {
    console.error("Delete merchant error:", error);
    return res.status(500).json({
      success: false,
      message: "Error deleting merchant",
      error: error.message,
    });
  }
};``

export const updateMerchantData = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.authUser?.userId;
    

    const files = req.files as {
      registrationDocument?: Express.Multer.File[];
      taxDocument?: Express.Multer.File[];
      identityDocument?: Express.Multer.File[];
      additionalDocuments?: Express.Multer.File[];
    };


    const updateData: Record<string, any> = {};
    const allowedFileds = ["businessName", "businessRegistrationNumber", "taxId", "businessType", "businessCategory", "address", "city", "state", "zipCode", "country", "businessPhone", "businessEmail", "website", "bankName", "accountNumber", "accountHolderName", "ifscCode", "swiftCode", "description", "registrationDocument", "taxDocument", "identityDocument", "additionalDocuments"];
    
    const sentFields = Object.keys(req.body);
    const invalidFields = sentFields.filter((field) => !allowedFileds.includes(field));
    
    if (invalidFields.length > 0){
      return res.status(400).json({
        success: false,
        message: `You cannot update the following fields: ${invalidFields.join(" ,")}`
      })
    }

    for (const field of allowedFileds){
      if (req.body[field] !== undefined){
        updateData[field] = req.body[field]
      }
    }

    // const existsRegistrationNumber = await prisma.merchantProfile.findFirst({
    //   where: {
    //     businessRegistrationNumber: req.body.businessRegistrationNumber
    //   }
    // })

    // if (existsRegistrationNumber){
    //   return res.status(400).json({
    //     success: false,
    //     message: "Provided business registration number is already in use"
    //   })
    // }

    const merchant = await prisma.merchantProfile.findFirst({
      where:{
        userId: id
      }
    });
    if (merchant?.profileStatus === "VERIFIED"){
      return res.status(400).json({
        success: false,
        message: "Profile verified. Therefore, couldn't be updated."
      });
    };
    if (files?.registrationDocument?.[0]) {
      updateData.registrationDocument =
        files.registrationDocument[0].path;
    }

    if (files?.taxDocument?.[0]) {
      updateData.taxDocument = files.taxDocument[0].path;
    }

    if (files?.identityDocument?.[0]) {
      updateData.identityDocument = files.identityDocument[0].path;
    }

    if (files?.additionalDocuments?.length) {
      updateData.additionalDocuments = files.additionalDocuments.map(
        (f) => f.path
      );
    }

    updateData.profileStatus = "PENDING_VERIFICATION";

    const updateMerchant = await prisma.merchantProfile.update({
      where:{
        userId: id
      },
      data: updateData
    })
    if (!updateMerchant){
      return res.status(400).json({
        success: true,
        message: "Your profile couldn't be updated"
      });
    }
    return res.status(200).json({
      success :true,
      message: "Profile updated successfully.",
      data: updateMerchant
    })

  } catch (error: any) {
      next(error);
  }
}


export const getGiftCardByMerchant = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { merchantId } = req.params; 
    const giftCards = await prisma.giftCard.findMany({
      where:{
        merchantId: merchantId
      }
    });
    if (!giftCards){
      return res.status(404).json({
        success: false,
        message: "No gift cards have been issued by this merchant yet."
      })
    }
    return res.status(200).json({
      success: true,
      message: "Gift cards fetched successfully.",
      data: giftCards
    });

    
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: "Error fetching gift cards",
      error: error.message
    })
  }
}

export const getVerifiedMerchants = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const merchant = await prisma.merchantProfile.findMany({
      where:{
        profileStatus: "VERIFIED"
      }
    });
    if (!merchant){
      return res.status(400).json({
        success: false,
        message: "Merchants not found"
      })
    }
    return res.status(200).json({
      success: true,
      message: "Merchants fetched successfully",
      data: merchant
    })
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: "Error fetching verified merchants",
      error: error.message
    })
  }
}