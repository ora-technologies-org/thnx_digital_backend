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
import { StatusCodes } from "../utils/statusCodes";
import { errorResponse, successResponse } from "../utils/response";
import { Status } from "@prisma/client";

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
      return res.status(StatusCodes.NOT_FOUND).json(errorResponse("Gift card not found"));
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


      return res.status(StatusCodes.BAD_REQUEST).json(errorResponse("This gift card is no longer available"));
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
      return res.status(StatusCodes.BAD_REQUEST).json(errorResponse("This gift card has expired"));
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
    

    return res.status(StatusCodes.CREATED).json(successResponse("Gift card purchased successfully! Check your email for details.",
        {purchase: {
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
          }
      }}));
  } catch (error: any) {

    if (error.name === "ZodError") {
      return res.status(400).json({
        success: false,
        message: "Validation error",
        errors: error.errors,
      });
    }

    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json(error("Internal Server error", error.message));
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
      return res.status(StatusCodes.NOT_FOUND).json(errorResponse("Gift card not found"));
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

    return res.status(StatusCodes.OK).json(successResponse("Gift card fetched successfully.",{
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
      }));
  } catch (error: any) {
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json(error("Internal Server error", error.message));
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
      return res.status(StatusCodes.UNAUTHORIZED).json(errorResponse("Unauthorized"));
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


      return res.status(StatusCodes.NOT_FOUND).json(errorResponse("Invalid QR code"));
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

      return res.status(StatusCodes.FORBIDDEN).json(errorResponse("This gift card does not belong to your business"));
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
      return res.status(400).json(successResponse("This gift card has expired", {expiresAt: purchasedCard.expiresAt}),);
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
      return res.status(StatusCodes.BAD_REQUEST).json(errorResponse(`Gift card is ${purchasedCard.status.toLowerCase().replace("_", " ")}`, { status: purchasedCard.status }));
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
      return res.status(StatusCodes.BAD_REQUEST).json({
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

    return res.status(StatusCodes.OK).json(successResponse(newBalance === 0
          ? "Gift card fully redeemed!"
          : "Gift card redeemed successfully", {
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
      })
     );
  } catch (error: any) {

    if (error.name === "ZodError") {
      return res.status(StatusCodes.BAD_REQUEST).json(error("Validation error", error.errors));
    }
      return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json(error("Internal Server error", error.message));
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
      return res.status(StatusCodes.UNAUTHORIZED).json(errorResponse("Unauthorized"));
    }

    // Get query params for pagination, search, and sorting
    const page = Math.max(parseInt(req.query.page as string) || 1, 1);
    const limit = Math.max(parseInt(req.query.limit as string) || 50, 1);
    const skip = (page - 1) * limit;
    const { search, sortBy = "redeemedAt", sortOrder = "desc" } = req.query;

    // Extended sortable fields based on Redemption model
    const allowedSortFields = [
      "redeemedAt",
      "amount",
      "balanceBefore",
      "balanceAfter",
      "locationName",
    ];
    const sortField = allowedSortFields.includes(sortBy as string)
      ? (sortBy as string)
      : "redeemedAt";
    const order = sortOrder === "asc" ? "asc" : "desc";

    const whereClause: any = {
      purchasedGiftCard: {
        giftCard: {
          merchantId,
        },
      },
    };

    // Enhanced search across multiple fields
    if (search) {
      whereClause.OR = [
        {
          purchasedGiftCard: {
            customerName: {
              contains: String(search),
              mode: "insensitive" as const,
            },
          },
        },
        {
          purchasedGiftCard: {
            customerEmail: {
              contains: String(search),
              mode: "insensitive" as const,
            },
          },
        },
        {
          redeemedBy: {
            name: {
              contains: String(search),
              mode: "insensitive" as const,
            },
          },
        },
        {
          redeemedBy: {
            email: {
              contains: String(search),
              mode: "insensitive" as const,
            },
          },
        },
        {
          purchasedGiftCard: {
            giftCard: {
              title: {
                contains: String(search),
                mode: "insensitive" as const,
              },
            },
          },
        },
        {
          locationName: {
            contains: String(search),
            mode: "insensitive" as const,
          },
        },
        {
          locationAddress: {
            contains: String(search),
            mode: "insensitive" as const,
          },
        },
        {
          notes: {
            contains: String(search),
            mode: "insensitive" as const,
          },
        },
      ];
    }

    const [redemptions, total] = await Promise.all([
      prisma.redemption.findMany({
        where: whereClause,
        include: {
          purchasedGiftCard: {
            include: {
              giftCard: {
                select: {
                  id: true,
                  title: true,
                  price: true,
                  description: true,
                },
              },
            },
          },
          redeemedBy: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
        orderBy: {
          [sortField]: order,
        },
        take: limit,
        skip,
      }),
      prisma.redemption.count({
        where: whereClause,
      }),
    ]);

    // Calculate comprehensive statistics
    const totalRevenue = redemptions.reduce(
      (sum, r) => sum + r.amount.toNumber(),
      0
    );

    const averageRedemption = total > 0 ? totalRevenue / total : 0;

    return res.status(StatusCodes.OK).json(
      successResponse("Redemptions history fetched successfully.", {
        data: redemptions,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
        filters: {
          search: search || null,
          sortBy: sortField,
          sortOrder: order,
        },
        stats: {
          totalRedemptions: total,
          totalRevenue: totalRevenue.toFixed(2),
          averageRedemption: averageRedemption.toFixed(2),
          pageRedemptions: redemptions.length,
          pageRevenue: redemptions
            .reduce((sum, r) => sum + r.amount.toNumber(), 0)
            .toFixed(2),
        },
      })
    );
  } catch (error: any) {
    console.error("Get redemption history error:", error);
    return res
      .status(StatusCodes.INTERNAL_SERVER_ERROR)
      .json({
        success: false,
        message: "Internal Server error",
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
      return res.status(StatusCodes.BAD_REQUEST).json(errorResponse("Invalid email address."));
    }

    const purchases = await prisma.purchasedGiftCard.findMany({
        where: {
          customerEmail: email.toLowerCase(),
        },
        orderBy: {
          purchasedAt: "desc",
        },
        select: {
          id: true,
          giftCardId: true,
          qrCode: true,
          customerName: true,
          customerEmail: true,
          customerPhone: true,
          purchaseAmount: true,
          currentBalance: true,
          status: true,
          paymentStatus: true,
          paymentMethod: true,
          transactionId: true,
          purchasedAt: true,
          expiresAt: true,
          lastUsedAt: true,

          giftCard: {
            select: {
              id: true,
              title: true,
              description: true,
              price: true,
              expiryDate: true,
              isActive: true,
              status: true,

              merchant: {
                select: {
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
            take: 5,
            orderBy: {
              redeemedAt: "desc",
            },
            select: {
              id: true,
              amount: true,
              balanceAfter: true,
              redeemedAt: true,
            },
          },

          _count: {
            select: {
              redemptions: true,
            },
          },
        },
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

    return res.status(StatusCodes.OK).json(successResponse("Cusotmer Purchases fetched successfullly.", {purchases, stats}));

  } catch (error: any) {
      return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json(errorResponse("Internal Server error", error.message));
  }
};

export const requestOtp = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { purchaseId } = req.body;
    if (!purchaseId){
      return res.status(StatusCodes.BAD_REQUEST).json(errorResponse("Purchased Id is required to request for otp."));
    }
    const purchasedGiftCard = await prisma.purchasedGiftCard.findUnique({
      where: {
        id: String(purchaseId)
      }
    });
    if (!purchasedGiftCard){
      return res.status(StatusCodes.NOT_FOUND).json(errorResponse("No purchase record found with the given id."));
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
    } catch (error: any) {
      return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json(error("Error sending mail to requested email."))
    }
    return res.status(StatusCodes.OK).json(successResponse("OTP has successfully been sent to your email."));

  } catch (error: any) {
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json(error("Internal Server error", error.message));
  }
}

export const verifyOtp = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { purchaseId, otp } = req.body;
    if (!purchaseId || !otp){
      return res.status(StatusCodes.BAD_REQUEST).json(errorResponse("PurchaseId and OTP are required for verification."));
    }
    const findOtp = await prisma.giftCardOtp.findFirst({
      where:{
        purchasedGiftCardId: purchaseId,
        otpToken: otp
      },
      orderBy:{
        createdAt: "desc"
      }
    });
    if (!findOtp){
      return res.status(StatusCodes.BAD_REQUEST).json(errorResponse("OTP not found, please try requesting for otp once again."));
    };

    if (findOtp.used === true){
      return res.status(StatusCodes.BAD_REQUEST).json(errorResponse("The provided otp has already been used."));
    }

    if (otp !== findOtp.otpToken){
      return res.status(StatusCodes.BAD_REQUEST).json(errorResponse("The provided otp is invalid."));
    }
    if (findOtp.otpExpiry < new Date()){
      return res.status(StatusCodes.BAD_REQUEST).json(errorResponse("The provided otp has been expired."));
    };
    const used = await prisma.giftCardOtp.update({
      where:{
        id: findOtp.id
      },data:{
        used: true
      }
    });
    return res.status(StatusCodes.OK).json(successResponse("OTP verified successfully"))

  } catch (error: any) {
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json(error("Internal Server error", error.message));
  }
}