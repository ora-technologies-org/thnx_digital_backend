import { NextFunction, Request, Response } from "express";
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
          isFirstTime: true
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



export const getOverallAnalytics = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const [giftCards, purchases, redemptions, activeGiftCard] = await Promise.all([
      prisma.giftCard.findMany({
        include: {
          purchases: true,
        },
      }),
      prisma.purchasedGiftCard.findMany({
        include: {
          redemptions: true,
        },
      }),
      prisma.redemption.findMany(),
      prisma.giftCard.groupBy({
        by: ['isActive'],
        _count: {
          id: true,
        },
      }),
    ]);

    const totalRevenue = purchases.reduce(
      (sum, purchase) => sum + Number(purchase.purchaseAmount),
      0
    );
    const redemptionAmount = redemptions.reduce(
      (sum, redemption) => sum + Number(redemption.amount),
      0
    );
    const outstandingBalance = purchases.reduce(
      (sum, purchase) => sum + Number(purchase.currentBalance),
      0
    );

    const activeCount = {
      activeCards: 0,
      inactiveCards: 0,
    };
    activeGiftCard.forEach((cards) => {
      if (cards.isActive === true) {
        activeCount.activeCards = cards._count.id;
      } else if (cards.isActive === false) {
        activeCount.inactiveCards = cards._count.id;
      }
    });

    const popularGiftCards = await prisma.giftCard.findMany({
      include: {
        _count: {
          select: {
            purchases: true,
          },
        },
        purchases: {
          select: {
            purchaseAmount: true,
          },
        },
      },
      orderBy: {
        purchases: {
          _count: 'desc',
        },
      },
      take: 5,
    });

    const popularGiftCardsWithRevenue = popularGiftCards.map((card) => ({
      id: card.id,
      title: card.title,
      price: card.price,
      totalSold: card._count.purchases,
      totalRevenue: card.purchases.reduce(
        (sum, p) => sum + Number(p.purchaseAmount),
        0
      ),
    }));

    // Revenue by month (last 12 months)
    const revenueByMonth = await getRevenueByMonth(purchases);

    // Redemptions by month (last 12 months)
    const redemptionsByMonth = await getRedemptionsByMonth(redemptions);

    // Customer metrics
    const customerMetrics = getCustomerMetrics(purchases);

    // Card utilization metrics
    const cardUtilization = getCardUtilization(purchases);

    // Calculate rates
    const averagePurchaseAmount =
      purchases.length > 0 ? totalRevenue / purchases.length : 0;
    const redemptionRate =
      totalRevenue > 0 ? (redemptionAmount / totalRevenue) * 100 : 0;

    const analyticsData: AnalyticsData = {
      totalGiftCardIssued: giftCards.length,
      totalRevenue,
      activeCards: activeCount.activeCards,
      inActiveCards: activeCount.inactiveCards,
      totalPurchases: purchases.length,
      totalRedemptions: redemptions.length,
      averagePurchaseAmount,
      redemptionRate,
      redemptionAmount,
      outstandingBalance,
      popularGiftCards: popularGiftCardsWithRevenue,
      revenueByMonth,
      redemptionsByMonth,
      customerMetrics,
      cardUtilization,
    };

    return res.status(200).json({
      success: true,
      message: 'Analytics fetched successfully',
      data: analyticsData,
    });
  } catch (error: any) {
    console.error('Analytics Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error fetching analytics',
      error: error.message,
    });
  }
};

export const generateAnalyticsPDF = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    // Fetch analytics data (reuse logic from getOverallAnalytics)
    const [giftCards, purchases, redemptions, activeGiftCard] = await Promise.all([
      prisma.giftCard.findMany({
        include: {
          purchases: true,
        },
      }),
      prisma.purchasedGiftCard.findMany({
        include: {
          redemptions: true,
        },
      }),
      prisma.redemption.findMany(),
      prisma.giftCard.groupBy({
        by: ['isActive'],
        _count: {
          id: true,
        },
      }),
    ]);

    const totalRevenue = purchases.reduce(
      (sum, purchase) => sum + Number(purchase.purchaseAmount),
      0
    );
    const redemptionAmount = redemptions.reduce(
      (sum, redemption) => sum + Number(redemption.amount),
      0
    );
    const outstandingBalance = purchases.reduce(
      (sum, purchase) => sum + Number(purchase.currentBalance),
      0
    );

    const activeCount = { activeCards: 0, inactiveCards: 0 };
    activeGiftCard.forEach((cards) => {
      if (cards.isActive === true) {
        activeCount.activeCards = cards._count.id;
      } else {
        activeCount.inactiveCards = cards._count.id;
      }
    });

    const popularGiftCards = await prisma.giftCard.findMany({
      include: {
        _count: { select: { purchases: true } },
        purchases: { select: { purchaseAmount: true } },
      },
      orderBy: { purchases: { _count: 'desc' } },
      take: 5,
    });

    const customerMetrics = getCustomerMetrics(purchases);
    const cardUtilization = getCardUtilization(purchases);
    const redemptionRate =
      totalRevenue > 0 ? (redemptionAmount / totalRevenue) * 100 : 0;

    // Create PDF
    const doc = new PDFDocument({ margin: 50, size: 'A4' });

    // Set response headers
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=analytics-report-${new Date().toISOString().split('T')[0]}.pdf`
    );

    // Pipe PDF to response
    doc.pipe(res);

    // Add content to PDF
    addPDFHeader(doc);
    addOverviewSection(doc, {
      totalRevenue,
      totalPurchases: purchases.length,
      totalRedemptions: redemptions.length,
      outstandingBalance,
      redemptionRate,
    });
    addGiftCardSection(doc, {
      total: giftCards.length,
      active: activeCount.activeCards,
      inactive: activeCount.inactiveCards,
    });
    addCustomerSection(doc, customerMetrics);
    addUtilizationSection(doc, cardUtilization);
    addPopularCardsSection(doc, popularGiftCards);
    addFooter(doc);

    // Finalize PDF
    doc.end();
  } catch (error: any) {
    console.error('PDF Generation Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error generating PDF',
      error: error.message,
    });
  }
};

// Helper functions
function getRevenueByMonth(purchases: any[]) {
  const monthlyData = new Map<string, number>();
  const now = new Date();

  // Initialize last 12 months
  for (let i = 11; i >= 0; i--) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    monthlyData.set(key, 0);
  }

  // Aggregate revenue by month
  purchases.forEach((purchase) => {
    const date = new Date(purchase.purchasedAt);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    if (monthlyData.has(key)) {
      monthlyData.set(key, monthlyData.get(key)! + Number(purchase.purchaseAmount));
    }
  });

  return Array.from(monthlyData.entries()).map(([month, revenue]) => ({
    month,
    revenue,
  }));
}

function getRedemptionsByMonth(redemptions: any[]) {
  const monthlyData = new Map<string, { count: number; amount: number }>();
  const now = new Date();

  for (let i = 11; i >= 0; i--) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    monthlyData.set(key, { count: 0, amount: 0 });
  }

  redemptions.forEach((redemption) => {
    const date = new Date(redemption.redeemedAt);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    if (monthlyData.has(key)) {
      const current = monthlyData.get(key)!;
      monthlyData.set(key, {
        count: current.count + 1,
        amount: current.amount + Number(redemption.amount),
      });
    }
  });

  return Array.from(monthlyData.entries()).map(([month, data]) => ({
    month,
    ...data,
  }));
}

function getCustomerMetrics(purchases: any[]) {
  const customerEmails = new Map<string, number>();

  purchases.forEach((purchase) => {
    const count = customerEmails.get(purchase.customerEmail) || 0;
    customerEmails.set(purchase.customerEmail, count + 1);
  });

  const totalCustomers = customerEmails.size;
  const repeatCustomers = Array.from(customerEmails.values()).filter(
    (count) => count > 1
  ).length;
  const totalRevenue = purchases.reduce(
    (sum, p) => sum + Number(p.purchaseAmount),
    0
  );
  const averageCustomerValue =
    totalCustomers > 0 ? totalRevenue / totalCustomers : 0;

  return {
    totalCustomers,
    repeatCustomers,
    averageCustomerValue,
  };
}

function getCardUtilization(purchases: any[]) {
  const now = new Date();
  let fullyRedeemed = 0;
  let partiallyRedeemed = 0;
  let unused = 0;
  let expired = 0;

  purchases.forEach((purchase) => {
    const balance = Number(purchase.currentBalance);
    const isExpired = new Date(purchase.expiresAt) < now;

    if (isExpired) {
      expired++;
    } else if (balance === 0) {
      fullyRedeemed++;
    } else if (balance < Number(purchase.purchaseAmount)) {
      partiallyRedeemed++;
    } else {
      unused++;
    }
  });

  return { fullyRedeemed, partiallyRedeemed, unused, expired };
}
/**
 * 
 * @param doc 
 */
// PDF Generation Helper Functions
function addPDFHeader(doc: PDFKit.PDFDocument) {
  doc
    .fontSize(24)
    .font('Helvetica-Bold')
    .text('Gift Card Analytics Report', { align: 'center' })
    .moveDown(0.5);

  doc
    .fontSize(12)
    .font('Helvetica')
    .text(`Generated on: ${new Date().toLocaleDateString()}`, { align: 'center' })
    .moveDown(1.5);

  doc
    .moveTo(50, doc.y)
    .lineTo(550, doc.y)
    .stroke()
    .moveDown(1);
}

function addOverviewSection(doc: PDFKit.PDFDocument, data: any) {
  doc.fontSize(16).font('Helvetica-Bold').text('Overview', { underline: true }).moveDown(0.5);

  doc.fontSize(11).font('Helvetica');
  doc.text(`Total Revenue: $${data.totalRevenue.toFixed(2)}`);
  doc.text(`Total Purchases: ${data.totalPurchases}`);
  doc.text(`Total Redemptions: ${data.totalRedemptions}`);
  doc.text(`Outstanding Balance: $${data.outstandingBalance.toFixed(2)}`);
  doc.text(`Redemption Rate: ${data.redemptionRate.toFixed(2)}%`);
  doc.moveDown(1.5);
}

function addGiftCardSection(doc: PDFKit.PDFDocument, data: any) {
  doc.fontSize(16).font('Helvetica-Bold').text('Gift Card Status', { underline: true }).moveDown(0.5);

  doc.fontSize(11).font('Helvetica');
  doc.text(`Total Gift Cards: ${data.total}`);
  doc.text(`Active Cards: ${data.active}`);
  doc.text(`Inactive Cards: ${data.inactive}`);
  doc.moveDown(1.5);
}

function addCustomerSection(doc: PDFKit.PDFDocument, data: any) {
  doc.fontSize(16).font('Helvetica-Bold').text('Customer Metrics', { underline: true }).moveDown(0.5);

  doc.fontSize(11).font('Helvetica');
  doc.text(`Total Customers: ${data.totalCustomers}`);
  doc.text(`Repeat Customers: ${data.repeatCustomers}`);
  doc.text(`Average Customer Value: $${data.averageCustomerValue.toFixed(2)}`);
  doc.moveDown(1.5);
}

function addUtilizationSection(doc: PDFKit.PDFDocument, data: any) {
  doc.fontSize(16).font('Helvetica-Bold').text('Card Utilization', { underline: true }).moveDown(0.5);

  doc.fontSize(11).font('Helvetica');
  doc.text(`Fully Redeemed: ${data.fullyRedeemed}`);
  doc.text(`Partially Redeemed: ${data.partiallyRedeemed}`);
  doc.text(`Unused: ${data.unused}`);
  doc.text(`Expired: ${data.expired}`);
  doc.moveDown(1.5);
}

function addPopularCardsSection(doc: PDFKit.PDFDocument, cards: any[]) {
  doc.fontSize(16).font('Helvetica-Bold').text('Top 5 Popular Gift Cards', { underline: true }).moveDown(0.5);

  doc.fontSize(11).font('Helvetica');
  cards.forEach((card, index) => {
    const revenue = card.purchases.reduce(
      (sum: number, p: any) => sum + Number(p.purchaseAmount),
      0
    );
    doc.text(
      `${index + 1}. ${card.title} - ${card._count.purchases} sold - $${revenue.toFixed(2)} revenue`
    );
  });
  doc.moveDown(1.5);
}

function addFooter(doc: PDFKit.PDFDocument) {
  const bottomMargin = 50;
  doc
    .fontSize(9)
    .font('Helvetica')
    .text(
      'This report is confidential and intended for internal use only.',
      50,
      doc.page.height - bottomMargin,
      { align: 'center', width: 500 }
    );
}

export const createSupportTicket = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { query, title } = req.body;
    if (!query || !title){
      return res.status(400).json({
        success: false,
        message: "Query and title are required to create a support ticket."
      });
    }
    const userId = req.authUser?.userId;
    const merchant = await prisma.merchantProfile.findUnique({
      where:{
        userId: userId
      }
    });
    if (!merchant){
      return res.status(404).json({
        success: true,
        message: "Merchant not found with given id."
      });
    }
    const createTicket = await prisma.supportTicket.create({
      data:{
        merchantId: merchant.id,
        title: title,
        merchantQuery: query
      }
    });
    if (!createTicket){
      return res.status(400).json({
        success: false,
        message: "Failed creating a support ticket"
      });
    }
    return res.status(200).json({
      success: true,
      message: "Support ticket created succesfully.",
      data: createTicket
    });

  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: "Error creating support ticket.",
      error: error.message
    })
  }
}

export const getAllSupportTickets = async (req:Request, res: Response, next: NextFunction) => {
  try {

    const { search, sortBy= "createdAt", order = "desc" } = req.query;

    const supportTickets = await prisma.supportTicket.findMany({
      where: search 
      ? {
        OR: [
          {
            title: {
              contains: String(search),
              mode: "insensitive"
            },
          },
          {
            merchant: {
              user: {
                name: {
                  contains: String(search),
                  mode: "insensitive",
                },
              },
            },
          },
          {
            merchant: {
              user: {
                email: {
                  contains: String(search),
                  mode: "insensitive",
                },
              },
            },
          },
        ],

      }: undefined,
      orderBy :{ 
        createadAt: order === "asc" ? "asc" : "desc"
      }
    });
    if (!supportTickets){
      return res.status(400).json({
        success: false,
        message: "Couldn't fetch support tickets."
      });
    }
    return res.status(200).json({
      success: true,
      message: "Fetched support tickets successfully.",
      count: supportTickets.length,
      data: supportTickets
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: "Error fetching support tickets",
      error: error.message
    })
  }
}

export const getSupportTicketById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { ticketId } = req.params;
    const supportTicket = await prisma.supportTicket.findFirst({
      where:{
        id: ticketId
      }
    });
    if (!ticketId){
      return res.status(404).json({
        success: true,
        message: "No support ticket found with given id."
      })
    }
    return res.status(200).json({
      success: true,
      message: "Support ticket fetched successfully",
      data: supportTicket
    });
    
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: "Error fetching support ticket",
      error: error.message
    })
  }
}