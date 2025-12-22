import { NextFunction, Request, Response } from "express";
import {
  purchaseGiftCardSchema,
  redeemGiftCardSchema,
} from "../validators/purchase.validator";
import prisma from "../utils/prisma.util";
import { Decimal } from "@prisma/client/runtime/library";
import {
  generateQRCodeString,
  generateQRCodeImage,
} from "../utils/qrcode.util";
import { ActivityLogger } from "../services/activityLog.service";
import { EmailService } from "../services/email.service";
import { otpGenerator } from "../helpers/otp/otpGenerator";
import { clientCommandMessageReg } from "bullmq";
import { sendOTPEmail, sendWelcomeEmail } from "../utils/email.util";

// Define authenticated request interface
interface AuthenticatedRequest extends Request {
  authUser?: {
    userId: string;
    email: string;
    role: string;
    isVerified: boolean;
    profileStatus?: string;
  };
}

export const purchaseGiftCard = async (req: Request, res: Response) => {
  try {
    const { giftCardId } = req.params;

    // Validate request body
    // const validatedData = purchaseGiftCardSchema.parse(req.body);

    const { customerName, customerEmail, customerPhone, paymentMethod, transactionId } = req.body
    // Check if gift card exists and is active
    const giftCard = await prisma.giftCard.findUnique({
      where: { id: giftCardId },
      include: {
        merchant: {
          include: {
            merchantProfile: true,
          },
        },
      },
    });

    if (!giftCard) {
      return res.status(404).json({
        success: false,
        message: "Gift card not found",
      });
    }

    if (!giftCard.isActive) {

      await ActivityLogger.log({
        actorType: 'user',
        action: 'purchase_failed',
        category: 'PURCHASE',
        description: `Purchase failed - gift card "${giftCard.title}" is inactive`,
        resourceType: 'gift_card',
        resourceId: giftCardId,
        metadata: { customerEmail: customerEmail, reason: 'inactive' },
        merchantId: giftCard.merchantId,
        severity: 'WARNING',
        req
      });


      return res.status(400).json({
        success: false,
        message: "This gift card is no longer available",
      });
    }

    // Check if gift card is expired
    if (new Date() > giftCard.expiryDate) {

      ActivityLogger.log({
        actorType: 'user',
        action: 'purchase_failed',
        category: 'PURCHASE',
        description: `Purchase failed - gift card "${giftCard.title}" is expired`,
        resourceType: 'gift_card',
        resourceId: giftCardId,
        metadata: { customerEmail: customerEmail, reason: 'expired', expiryDate: giftCard.expiryDate },
        merchantId: giftCard.merchantId,
        severity: 'WARNING',
        req
      });
      return res.status(400).json({
        success: false,
        message: "This gift card has expired",
      });
    }

    // Generate unique QR code with Thnx-Digital prefix
    const qrCode = generateQRCodeString();

    // Create purchased gift card
    const purchasedCard = await prisma.purchasedGiftCard.create({
      data: {
        giftCardId: giftCard.id,
        qrCode,
        customerName: customerName,
        customerEmail: customerEmail,
        customerPhone: customerPhone,
        purchaseAmount: giftCard.price,
        currentBalance: giftCard.price,
        expiresAt: giftCard.expiryDate,
        paymentMethod: paymentMethod,
        transactionId: transactionId,
        paymentStatus: transactionId ? "COMPLETED" : "PENDING",
      },
      include: {
        giftCard: {
          include: {
            merchant: {
              include: {
                merchantProfile: true,
              },
            },
          },
        },
      },
    });

    ActivityLogger.purchaseCreated(
      purchasedCard.id,
      giftCard.title,
      customerEmail,
      giftCard.price.toNumber(),
      giftCard.merchantId,
      req
    );

    // Log payment status
    if (transactionId) {
      ActivityLogger.paymentCompleted(
        purchasedCard.id,
        transactionId,
        giftCard.price.toNumber(),
        giftCard.merchantId
      );
    }



    // ✅ FIXED: Generate QR code image with ONLY the QR code ID
    // Not the balance or other dynamic data!
    const qrCodeImage = await generateQRCodeImage(purchasedCard.qrCode);

    // Send email with gift card (continue even if email fails)
    try {
      EmailService.sendGiftCardEmail(
        purchasedCard.customerEmail,
        purchasedCard,
        qrCodeImage,
      );
    } catch (emailError) {
      console.error("Failed to send email:", emailError);
      // Continue - user still gets the response

      ActivityLogger.log({
        actorType: 'system',
        action: 'email_failed',
        category: 'PURCHASE',
        description: `Failed to send gift card email to ${customerEmail}`,
        resourceType: 'purchased_gift_card',
        resourceId: purchasedCard.id,
        metadata: { error: (emailError as Error).message },
        merchantId: giftCard.merchantId,
        severity: 'ERROR'
      });
    }
    

    return res.status(201).json({
      success: true,
      message:
        "Gift card purchased successfully! Check your email for details.",
      data: {
        purchase: {
          id: purchasedCard.id,
          qrCode: purchasedCard.qrCode,
          qrCodeImage, // Base64 image - contains ONLY the qrCode ID
          customerName: purchasedCard.customerName,
          customerEmail: purchasedCard.customerEmail,
          purchaseAmount: purchasedCard.purchaseAmount.toString(),
          currentBalance: purchasedCard.currentBalance.toString(),
          status: purchasedCard.status,
          purchasedAt: purchasedCard.purchasedAt,
          expiresAt: purchasedCard.expiresAt,
          giftCard: {
            id: giftCard.id,
            title: giftCard.title,
            description: giftCard.description,
          },
          merchant: {
            businessName:
              giftCard.merchant.merchantProfile?.businessName ||
              giftCard.merchant.name,
            city: giftCard.merchant.merchantProfile?.city,
            country: giftCard.merchant.merchantProfile?.country,
          },
        },
      },
    });
  } catch (error: any) {
    console.error("Purchase gift card error:", error);

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
 * Get purchased gift card details by QR code
 * @route GET /api/purchases/qr/:qrCode
 * @access Public (for verification)
 */
export const getGiftCardByQR = async (req: Request, res: Response) => {
  try {
    const { qrCode } = req.params;

    const purchasedCard = await prisma.purchasedGiftCard.findUnique({
      where: { qrCode },
      include: {
        giftCard: {
          include: {
            merchant: {
              include: {
                merchantProfile: true,
              },
            },
          },
        },
        redemptions: {
          orderBy: { redeemedAt: "desc" },
          take: 10, // Last 10 redemptions
          include: {
            redeemedBy: {
              select: {
                name: true,
                email: true,
              },
            },
          },
        },
      },
    });

    if (!purchasedCard) {
      return res.status(404).json({
        success: false,
        message: "Gift card not found",
      });
    }

    // Auto-update status if expired
    let status = purchasedCard.status;
    if (new Date() > purchasedCard.expiresAt && status === "ACTIVE") {
      status = "EXPIRED";
      await prisma.purchasedGiftCard.update({
        where: { id: purchasedCard.id },
        data: { status: "EXPIRED" },
      });

      await ActivityLogger.log({
        actorType: 'system',
        action: 'auto_expired',
        category: 'PURCHASE',
        description: `Gift card auto-expired on balance check`,
        resourceType: 'purchased_gift_card',
        resourceId: purchasedCard.id,
        merchantId: purchasedCard.giftCard.merchantId
      });
    }
    

    // Calculate total redeemed amount
    const totalRedeemed = purchasedCard.redemptions.reduce(
      (sum, r) => sum + r.amount.toNumber(),
      0,
    );

    return res.status(200).json({
      success: true,
      data: {
        purchase: {
          id: purchasedCard.id,
          qrCode: purchasedCard.qrCode,
          customerName: purchasedCard.customerName,
          customerEmail: purchasedCard.customerEmail,
          customerPhone: purchasedCard.customerPhone,
          purchaseAmount: purchasedCard.purchaseAmount.toString(),
          currentBalance: purchasedCard.currentBalance.toString(),
          totalRedeemed: totalRedeemed.toFixed(2),
          status,
          purchasedAt: purchasedCard.purchasedAt,
          expiresAt: purchasedCard.expiresAt,
          lastUsedAt: purchasedCard.lastUsedAt,
          giftCard: {
            id: purchasedCard.giftCard.id,
            title: purchasedCard.giftCard.title,
            description: purchasedCard.giftCard.description,
          },
          merchant: {
            businessName:
              purchasedCard.giftCard.merchant.merchantProfile?.businessName ||
              purchasedCard.giftCard.merchant.name,
            businessPhone:
              purchasedCard.giftCard.merchant.merchantProfile?.businessPhone,
            address: purchasedCard.giftCard.merchant.merchantProfile?.address,
            city: purchasedCard.giftCard.merchant.merchantProfile?.city,
          },
          recentRedemptions: purchasedCard.redemptions,
          redemptionCount: purchasedCard.redemptions.length,
        },
      },
    });
  } catch (error: any) {
    console.error("Get gift card by QR error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

/**
 * Redeem gift card (Merchant only)
 * @route POST /api/purchases/redeem
 * @access Merchant (Verified)
 */
export const redeemGiftCard = async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const merchantId = authReq.authUser?.userId;

    if (!merchantId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    // Validate request body

    const {qrCode, amount, locationName, locationAddress, notes} = req.body;

    // Find purchased gift card
    const purchasedCard = await prisma.purchasedGiftCard.findUnique({
      where: { qrCode: qrCode },
      include: {
        giftCard: {
          include: {
            merchant: true,
          },
        },
      },
    });

    if (!purchasedCard) {
      await ActivityLogger.verificationFailed(
        qrCode,
        'Invalid QR code',
        merchantId,
        undefined,
        req
      );


      return res.status(404).json({
        success: false,
        message: "Invalid QR code",
      });
    }

    // Check if the gift card belongs to this merchant
    if (purchasedCard.giftCard.merchantId !== merchantId) {

      await ActivityLogger.verificationFailed(
        qrCode,
        'Gift card belongs to different merchant',
        merchantId,
        purchasedCard.giftCard.merchantId,
        req
      );

      return res.status(403).json({
        success: false,
        message: "This gift card does not belong to your business",
      });
    }

    // Check if expired
    if (new Date() > purchasedCard.expiresAt) {

      await ActivityLogger.verificationFailed(
        qrCode,
        'Gift card expired',
        merchantId,
        merchantId,
        req
      );
      return res.status(400).json({
        success: false,
        message: "This gift card has expired",
        expiresAt: purchasedCard.expiresAt,
      });
    }

    // Check status
    if (purchasedCard.status !== "ACTIVE") {

      await ActivityLogger.verificationFailed(
        qrCode,
        `Gift card status: ${purchasedCard.status}`,
        merchantId,
        merchantId,
        req
      );
      return res.status(400).json({
        success: false,
        message: `Gift card is ${purchasedCard.status.toLowerCase().replace("_", " ")}`,
        status: purchasedCard.status,
      });
    }

    // Check if sufficient balance
    const currentBalance = purchasedCard.currentBalance.toNumber();
    if (amount > currentBalance) {

      await ActivityLogger.log({
        actorId: merchantId,
        actorType: 'merchant',
        action: 'redemption_failed',
        category: 'REDEMPTION',
        description: `Redemption failed - insufficient balance. Requested: ₹${amount}, Available: ₹${currentBalance}`,
        resourceType: 'purchased_gift_card',
        resourceId: purchasedCard.id,
        metadata: { 
          requestedAmount: amount, 
          availableBalance: currentBalance,
          qrCode: qrCode.substring(0, 8) + '...'
        },
        merchantId,
        severity: 'WARNING',
        req
      });
      return res.status(400).json({
        success: false,
        message: `Insufficient balance. Available: ₹${currentBalance.toFixed(2)}`,
        currentBalance: currentBalance.toFixed(2),
        requestedAmount: amount.toFixed(2),
      });
    }

    // Calculate new balance
    const newBalance = currentBalance - amount;
    const balanceBefore = new Decimal(currentBalance);
    const balanceAfter = new Decimal(newBalance);

    // Create redemption in transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create redemption record
      const redemption = await tx.redemption.create({
        data: {
          purchasedGiftCardId: purchasedCard.id,
          redeemedById: merchantId,
          amount: new Decimal(amount),
          balanceBefore,
          balanceAfter,
          locationName: locationName,
          locationAddress: locationAddress,
          notes: notes,
        },
        include: {
          redeemedBy: {
            select: {
              name: true,
              email: true,
            },
          },
        },
      });

      // Update purchased gift card
      const updateData: any = {
        currentBalance: balanceAfter,
        lastUsedAt: new Date(),
      };

      await ActivityLogger.redemptionSuccess(
        // result.redemption.id || "",
        "",
        purchasedCard.id,
        amount,
        newBalance,
        merchantId,
        merchantId,
        req
    );

      // If balance is zero, mark as fully redeemed
      if (newBalance === 0) {
        
        updateData.status = "FULLY_REDEEMED";
      }

      const updatedCard = await tx.purchasedGiftCard.update({
        where: { id: purchasedCard.id },
        data: updateData,
      });

      return { redemption, updatedCard };
    });



    // Log if fully redeemed
    if (newBalance === 0) {
      await ActivityLogger.redemptionFullyRedeemed(
        purchasedCard.id,
        purchasedCard.purchaseAmount.toNumber(),
        merchantId
      );
    }

    // Log verification success
    await ActivityLogger.verificationSuccess(
      purchasedCard.id,
      qrCode.substring(0, 8) + '...',
      merchantId,
      merchantId,
      req
    );

    return res.status(200).json({
      success: true,
      message:
        newBalance === 0
          ? "Gift card fully redeemed!"
          : "Gift card redeemed successfully",
      data: {
        redemption: {
          id: result.redemption.id,
          amount: result.redemption.amount.toString(),
          balanceBefore: result.redemption.balanceBefore.toString(),
          balanceAfter: result.redemption.balanceAfter.toString(),
          redeemedAt: result.redemption.redeemedAt,
          redeemedBy: result.redemption.redeemedBy.name,
          location: result.redemption.locationName,
        },
        remainingBalance: result.updatedCard.currentBalance.toString(),
        status: result.updatedCard.status,
        qrCode: purchasedCard.qrCode, // Same QR code - balance updated in DB
      },
    });
  } catch (error: any) {
    console.error("Redeem gift card error:", error);

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
 * Get merchant's redemption history
 * @route GET /api/purchases/redemptions
 * @access Merchant (Verified)
 */
export const getRedemptionHistory = async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const merchantId = authReq.authUser?.userId;

    if (!merchantId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    // Get query params for pagination
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const skip = (page - 1) * limit;

    const [redemptions, total] = await Promise.all([
      prisma.redemption.findMany({
        where: {
          purchasedGiftCard: {
            giftCard: {
              merchantId,
            },
          },
        },
        include: {
          purchasedGiftCard: {
            include: {
              giftCard: {
                select: {
                  title: true,
                  price: true,
                },
              },
            },
          },
          redeemedBy: {
            select: {
              name: true,
              email: true,
            },
          },
        },
        orderBy: { redeemedAt: "desc" },
        take: limit,
        skip,
      }),
      prisma.redemption.count({
        where: {
          purchasedGiftCard: {
            giftCard: {
              merchantId,
            },
          },
        },
      }),
    ]);

    // Calculate total revenue from redemptions
    const totalRevenue = redemptions.reduce(
      (sum, r) => sum + r.amount.toNumber(),
      0,
    );

    return res.status(200).json({
      success: true,
      data: {
        redemptions,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
        stats: {
          totalRedemptions: total,
          totalRevenue: totalRevenue.toFixed(2),
        },
      },
    });
  } catch (error: any) {
    console.error("Get redemption history error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

/**
 * Get customer's purchase history by email (No login required)
 * @route GET /api/purchases/customer/:email
 * @access Public
 */
export const getCustomerPurchases = async (req: Request, res: Response) => {
  try {
    const { email } = req.params;

    // Basic email validation
    if (!email || !email.includes("@")) {
      return res.status(400).json({
        success: false,
        message: "Invalid email address",
      });
    }

    const purchases = await prisma.purchasedGiftCard.findMany({
      where: { customerEmail: email.toLowerCase() },
      include: {
        giftCard: {
          include: {
            merchant: {
              include: {
                merchantProfile: {
                  select: {
                    businessName: true,
                    logo: true,
                    city: true,
                    businessPhone: true,
                  },
                },
              },
            },
          },
        },
        redemptions: {
          orderBy: { redeemedAt: "desc" },
          take: 5, // Last 5 redemptions per card
        },
        _count: {
          select: {
            redemptions: true,
          },
        },
      },
      orderBy: { purchasedAt: "desc" },
    });

    // Calculate totals
    const stats = {
      totalPurchased: purchases.length,
      totalSpent: purchases.reduce(
        (sum, p) => sum + p.purchaseAmount.toNumber(),
        0,
      ),
      totalBalance: purchases
        .filter((p) => p.status === "ACTIVE")
        .reduce((sum, p) => sum + p.currentBalance.toNumber(), 0),
      activeCards: purchases.filter((p) => p.status === "ACTIVE").length,
      expiredCards: purchases.filter((p) => p.status === "EXPIRED").length,
      fullyRedeemedCards: purchases.filter((p) => p.status === "FULLY_REDEEMED")
        .length,
    };

    return res.status(200).json({
      success: true,
      data: {
        purchases,
        stats,
      },
    });
  } catch (error: any) {
    console.error("Get customer purchases error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

export const requestOtp = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { purchaseId } = req.body;
    if (!purchaseId){
      return res.status(400).json({
        success: false,
        message: "Purchased Id is required to request for otp",
      });
    }
    const purchasedGiftCard = await prisma.purchasedGiftCard.findUnique({
      where: {
        id: String(purchaseId)
      }
    });
    if (!purchasedGiftCard){
      return res.status(404).json({
        success: false,
        message: "No purchase record found with the given id."
      });
    }
    const otp = await otpGenerator(3);
    const createOTP = await prisma.giftCardOtp.create({
      data:{
        purchasedGiftCardId: purchaseId,
        otpToken: otp.otp,
        otpExpiry: otp.otpExpiry,
        used: false,
      }
    });
    try {
      const sendOTP = sendOTPEmail(purchasedGiftCard?.customerEmail!, otp.otp);
    } catch (error) {
      return res.status(400).json({
        success: false,
        message: "Error sending mail to requested email."
      })
    }
    return res.status(200).json({
      success: false,
      message: "OTP has successfully been sent to your email."
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: "Internal Server error",
      error: error.message
    })
  }
}