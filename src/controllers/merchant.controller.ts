import { Request, Response } from "express";
import prisma from "../utils/prisma.util";
import {
  adminCreateMerchantSchema,
  completeProfileSchema,
  merchantQuickRegisterSchema,
} from "../validators/auth.validator";
import { AuthenticatedRequest } from "./auth.controller";
import bcrypt from "bcrypt";
import { generateTokens } from "../utils/jwt.util";
import { ActivityLogger } from "../services/activityLog.service";
import { EmailService } from "../services/email.service";
import notificationService from "../services/notification.service";
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

    ActivityLogger.register(user.id, user.email, 'MERCHANT', req);

      await notificationService.onMerchantRegistered(
      user.id,
      user.name || validatedData.name
    );


    // Send welcome email with credentials
    EmailService.sendWelcomeEmail(
      user.email,
      user.name || "Merchant",
      validatedData.password, // Send original password (before hashing)
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

    ActivityLogger.merchantProfileUpdated(
      updatedProfile.id,
      userId,
      updatedProfile.businessName,
      { action: 'profile_completed', documentsUploaded: Object.keys(documentData).filter(k => documentData[k as keyof typeof documentData]) },
      req
    );
    
    ActivityLogger.merchantSubmittedForVerification(
      updatedProfile.id,
      userId,
      updatedProfile.businessName,
      req
    );

      await notificationService.onProfileSubmittedForVerification(
      userId,
      updatedProfile.businessName,
      updatedProfile.id
    );

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
    const userId = req.authUser?.userId;

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
    const userId = req.authUser?.userId;
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

    ActivityLogger.merchantProfileUpdated(
      updatedProfile.id,
      userId,
      updatedProfile.businessName,
      { action: 'resubmitted_after_rejection' },
      req
    );
    
    ActivityLogger.merchantSubmittedForVerification(
      updatedProfile.id,
      userId,
      updatedProfile.businessName,
      req
    );

    await notificationService.onProfileSubmittedForVerification(
      userId,
      updatedProfile.businessName,
      updatedProfile.id
    );





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

    ActivityLogger.merchantProfileUpdated(
      updatedProfile.id,
      userId,
      updatedProfile.businessName,
      { fieldsUpdated: Object.keys(updates) },
      req
    );

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

    const result = await prisma.$transaction(async (tx) => {
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
        },
      });

      const merchantProfile = await tx.merchantProfile.create({
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
        },
      });

      return { user: newUser, merchantProfile };
    });

    // Log admin creating merchant
    ActivityLogger.userCreated(result.user.id, result.user.email, adminId!, req);
    
    ActivityLogger.merchantProfileCreated(
      result.merchantProfile.id,
      result.user.id,
      validatedData.businessName,
      req
    );
    
    // Log auto-verification by admin
    ActivityLogger.merchantVerified(
      result.merchantProfile.id,
      validatedData.businessName,
      adminId!,
      req
    );

    await notificationService.onProfileVerified(result.user.id);



  

    EmailService.sendWelcomeEmail(
      result.user.email,
      result.user.name || "Merchant",
      validatedData.password,
    );

    return res.status(201).json({
      success: true,
      message: "Merchant created and verified successfully",
      data: {
        user: {
          id: result.user.id,
          email: result.user.email,
          name: result.user.name,
          role: result.user.role,
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
 * @route   GET /api/auth/admin/merchants/pending
 * @desc    Get all pending merchant verifications
 * @access  Admin only
 */
export const getPendingMerchants = async (req: Request, res: Response) => {
  try {
    const pendingMerchants = await prisma.merchantProfile.findMany({
      where: {
        profileStatus: "PENDING_VERIFICATION",
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
        createdAt: "desc",
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

    if (action === "approve") {
      ActivityLogger.merchantVerified(
        updatedProfile.id,
        updatedProfile.businessName,
        adminId!,
        req
      );

      await notificationService.onProfileVerified(merchantId);
    } else {
      ActivityLogger.merchantRejected(
        updatedProfile.id,
        updatedProfile.businessName,
        adminId!,
        rejectionReason,
        req
      );

      await notificationService.onProfileRejected(merchantId, rejectionReason);

    }

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
        createdAt: "desc",
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
    console.error("Get all merchants error:", error);
    return res.status(500).json({
      success: false,
      message: "Error fetching merchants",
      error: error.message,
    });
  }
};

/**
 * @route   DELETE /api/auth/admin/merchants/:merchantId
 * @desc    Admin delete merchant (soft delete or hard delete)
 * @access  Admin only
 */
export const deleteMerchant = async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const { merchantId } = req.params;
    const { hardDelete = false } = req.body; // Optional: permanently delete
    const adminId = authReq.authUser?.userId;


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

      ActivityLogger.log({
        actorId: adminId,
        actorType: 'admin',
        action: 'hard_deleted',
        category: 'MERCHANT',
        description: `Merchant "${merchantProfile.businessName}" permanently deleted`,
        resourceType: 'merchant_profile',
        resourceId: merchantProfile.id,
        metadata: { 
          merchantEmail: merchantProfile.user.email,
          businessName: merchantProfile.businessName 
        },
        severity: 'WARNING',
        req
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

      ActivityLogger.userDeactivated(merchantId, adminId!, req);


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
};
