

import { Request, Response } from 'express';
import prisma from '../utils/prisma.util';
import { completeProfileSchema } from '../validators/auth.validator';

/**
 * @route   GET /api/merchant/profile
 * @desc    Get merchant's own profile with full details
 * @access  Merchant
 */
export const getMerchantProfile = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized',
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
        message: 'Merchant profile not found',
      });
    }

    // Determine completion percentage
    const requiredFields = [
      'businessName',
      'address',
      'city',
      'country',
      'businessPhone',
      'businessEmail',
      'bankName',
      'accountNumber',
      'accountHolderName',
      'identityDocument',
    ];

    const filledFields = requiredFields.filter(
      (field) => merchantProfile[field as keyof typeof merchantProfile]
    );
    const completionPercentage = Math.round(
      (filledFields.length / requiredFields.length) * 100
    );

    // Check what's missing
    const missingFields = requiredFields.filter(
      (field) => !merchantProfile[field as keyof typeof merchantProfile]
    );

    return res.status(200).json({
      success: true,
      data: {
        profile: merchantProfile,
        stats: {
          completionPercentage,
          missingFields,
          isComplete: merchantProfile.profileStatus !== 'INCOMPLETE',
          isPending: merchantProfile.profileStatus === 'PENDING_VERIFICATION',
          isVerified: merchantProfile.profileStatus === 'VERIFIED',
          isRejected: merchantProfile.profileStatus === 'REJECTED',
        },
      },
    });
  } catch (error: any) {
    console.error('Get merchant profile error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error fetching merchant profile',
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
    const userId = req.user?.userId;
    const files = req.files as { [fieldname: string]: Express.Multer.File[] };

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized',
      });
    }

    // Get existing merchant profile
    const existingProfile = await prisma.merchantProfile.findUnique({
      where: { userId },
    });

    if (!existingProfile) {
      return res.status(404).json({
        success: false,
        message: 'Merchant profile not found',
      });
    }

    // Only allow resubmission if profile is rejected
    if (existingProfile.profileStatus !== 'REJECTED') {
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
      taxDocument:
        files?.taxDocument?.[0]?.path || existingProfile.taxDocument,
      identityDocument:
        files?.identityDocument?.[0]?.path ||
        existingProfile.identityDocument,
      additionalDocuments: files?.additionalDocuments
        ? files.additionalDocuments.map((f) => f.path)
        : existingProfile.additionalDocuments,
    };

    // Ensure identity document is present
    if (!documentData.identityDocument) {
      return res.status(400).json({
        success: false,
        message: 'Identity document is required',
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
        additionalDocuments: documentData.additionalDocuments,

        // Clear rejection info and update status
        profileStatus: 'PENDING_VERIFICATION',
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

    // TODO: Send notification to admin about resubmission
    // TODO: Send email to merchant confirming resubmission

    return res.status(200).json({
      success: true,
      message: 'Profile resubmitted successfully! Waiting for admin verification.',
      data: {
        profile: updatedProfile,
      },
    });
  } catch (error: any) {
    console.error('Resubmit profile error:', error);

    if (error.name === 'ZodError') {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.errors,
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Error resubmitting profile',
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
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized',
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
      Object.entries(allowedUpdates).filter(([_, v]) => v !== undefined)
    );

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid fields to update',
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
      message: 'Profile updated successfully',
      data: {
        profile: updatedProfile,
      },
    });
  } catch (error: any) {
    console.error('Update profile error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error updating profile',
      error: error.message,
    });
  }
};