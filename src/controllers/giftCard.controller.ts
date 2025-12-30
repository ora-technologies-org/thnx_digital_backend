
import { Request, Response } from 'express';
import { 
  createGiftCardSchema, 
  createSettingsSchema, 
  udpateSettingSchema, 
  updateGiftCardSchema 
} from '../validators/giftCard.validator';
import prisma from '../utils/prisma.util';
import { Decimal } from '@prisma/client/runtime/library';
import { ActivityLogger } from '../services/activityLog.service';
import { file, flushPages } from 'pdfkit';
import { StatusCodes } from '../utils/statusCodes';
import { successResponse, errorResponse } from '../utils/response';

// const GIFT_CARD_LIMIT = 10;

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

/**
 * Create a new gift card
 * @route POST /api/gift-cards
 * @access Merchant (Verified)
 */
export const createGiftCard = async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const merchantId = authReq.authUser?.userId;

    if (!merchantId) {
      return res.status(StatusCodes.BAD_REQUEST).json(errorResponse("Unauthorized"));
    }

    const merchant = await prisma.merchantProfile.findUnique({
      where:{
        userId: merchantId
      },include:{
        settings: true
      }
    });
    
    if (!merchant){
      return res.status(StatusCodes.NOT_FOUND).json(errorResponse("Merchant not found with given Id."))
    }

    // Validate request body
    const {title, description, price, expiryDate} = req.body;

    // Check gift card limit (only count active cards)
    const existingCardsCount = await prisma.giftCard.count({
      where: { 
        merchantId,
        isActive: true // Only count active cards
      },
    });

    if (existingCardsCount >= merchant.giftCardLimit) {
      return res.status(StatusCodes.BAD_REQUEST).json(errorResponse(`You have reached the maximum limit of ${merchant.giftCardLimit} active gift cards`));
    }
    // Create gift card
    const giftCard = await prisma.giftCard.create({
      data: {
        merchantId,
        title: title,
        description: description,
        price: new Decimal(price),
        expiryDate: new Date(expiryDate),
        merchantLogo: merchant.businessLogo,
      },
      include: {
        merchant: {
          select: {
            id: true,
            name: true,
            email: true,
            merchantProfile: {
              select: {
                businessName: true,
              },
            },
          },
        },
      },
    });

     await ActivityLogger.giftCardCreated(
      giftCard.id,
      merchantId,
      giftCard.title,
      price,
      req
    );

    return res.status(StatusCodes.CREATED).json(successResponse("Gift card created successfully", { giftCard, settings: merchant.settings}));

  } catch (error: any) {
    console.error('Create gift card error:', error);

    if (error.name === 'ZodError') {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.errors,
      });
    }

    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Internal server error',
      error: error.message,
    });
  }
};

/**
 * Get all gift cards for the logged-in merchant
 * @route GET /api/gift-cards
 * @access Merchant (Verified)
 */
export const getMyGiftCards = async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const merchantId = authReq.authUser?.userId;
    if (!merchantId) {
      return res
        .status(StatusCodes.UNAUTHORIZED)
        .json(errorResponse("Unauthorized"));
    }

    const merchant = await prisma.merchantProfile.findUnique({
      where: {
        userId: merchantId,
      },
      include: {
        settings: true,
      },
    });

    if (!merchant) {
      return res
        .status(StatusCodes.NOT_FOUND)
        .json(errorResponse("Merchant not found with given Id."));
    }

    // Pagination params
    const page = Math.max(parseInt(req.query.page as string) || 1, 1);
    const limit = Math.max(parseInt(req.query.limit as string) || 10, 1);
    const skip = (page - 1) * limit;

    // Search parameter
    const search = req.query.search as string;

    // Sort parameters
    const sortBy = (req.query.sortBy as string) || 'createdAt';
    const sortOrder = (req.query.sortOrder as string) === 'asc' ? 'asc' : 'desc';
    console.log(sortBy);
    console.log(sortOrder);
    const whereClause: any = { merchantId };

    // Add search filter if provided
    if (search) {
      whereClause.title = {
        contains: search,
        mode: 'insensitive', // Case-insensitive search
      };
    }

    // Validate and set orderBy
    const validSortFields = ['price', 'createdAt', 'expiryDate', 'title'];
    const orderByField = validSortFields.includes(sortBy) ? sortBy : 'createdAt';
    const orderBy: any = { [orderByField]: sortOrder };

    //expiry date

    const today = new Date();
    const expiryIn30Days = new Date();
    expiryIn30Days.setDate(today.getDate() + 30);


    const [
      giftCards,
      total,
      activeCardsCount,
      totalValue,
      expiringSoon
    ] = await Promise.all([
      prisma.giftCard.findMany({
        where: whereClause,
        skip,
        take: limit,
        orderBy,
        include: {
          merchant: {
            select: {
              id: true,
              name: true,
              merchantProfile: {
                select: {
                  businessName: true,
                },
              },
            },
          },
          _count: {
            select: {
              purchases: true,
            },
          },
        },
      }),
      prisma.giftCard.count({
        where: whereClause,
      }),
      prisma.giftCard.count({
        where: {
          merchantId,
          status: 'ACTIVE',
        },
      }),
      prisma.giftCard.aggregate({
        where:{
          merchantId
        },_sum:{
          price: true
        }
      }),
      prisma.giftCard.findMany({
        where: {
          merchantId,
          expiryDate: {
            gte: today,
            lte: expiryIn30Days,
          },
          status: 'ACTIVE',
        },
        orderBy: {
          expiryDate: 'asc',
        },
        take: 10, // optional: limit to top 10 soonest expiring
      }),

    ]);

    return res.status(StatusCodes.OK).json(
      successResponse("Gift cards fetched successfully.", {
        giftCards,
        settings: merchant.settings,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
        filters: {
          search: search || null,
          sortBy: orderByField,
          sortOrder,
        },
        totalGiftCards: giftCards.length,
        activeCards: activeCardsCount,
        totalValue: totalValue._sum.price,
        expiringSoon:expiringSoon.length,
        limitAllowed: merchant.giftCardLimit,
        remaining: Math.max(0, merchant.giftCardLimit - activeCardsCount),
      })
    );
  } catch (error: any) {
    console.error("Get gift cards error:", error);

    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};



/**
 * Get a single gift card by ID
 * @route GET /api/gift-cards/:id
 * @access Merchant (Verified)
 */
export const getGiftCardById = async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const merchantId = authReq.authUser?.userId;
    const { id } = req.params;

    if (!merchantId) {
      return res.status(StatusCodes.UNAUTHORIZED).json(errorResponse("Unauthorized"));
    }

    const merchant = await prisma.merchantProfile.findUnique({
      where:{
        userId: merchantId
      },include:{
        settings: true
      }
    });
    
    if (!merchant){
      return res.status(StatusCodes.BAD_REQUEST).json(errorResponse("No merchant found with given id."));
    }

    const giftCard = await prisma.giftCard.findUnique({
      where: { id },
      include: {
        merchant: {
          select: {
            id: true,
            name: true,
            merchantProfile: {
              select: {
                businessName: true,
              },
            },
          },
        },
        purchases: {
          select: {
            id: true,
            customerName: true,
            customerEmail: true,
            purchaseAmount: true,
            currentBalance: true,
            status: true,
            purchasedAt: true,
          },
          orderBy: {
            purchasedAt: 'desc',
          },
        },
      },
    });

    if (!giftCard) {
      return res.status(StatusCodes.NOT_FOUND).json(errorResponse("Gift card not found."));
    }

    // Check if the gift card belongs to the merchant
    if (giftCard.merchantId !== merchantId) {
      return res.status(StatusCodes.FORBIDDEN).json(errorResponse("You do not have permission to access this gift card."));
    }

    return res.status(StatusCodes.OK).json(successResponse("Gift card fetched successfully.",{ 
        giftCard,
        settings: merchant.settings
      }));
  } catch (error: any) {
    console.error('Get gift card error:', error);

    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Internal server error',
      error: error.message,
    });
  }
};

/**
 * Update a gift card
 * @route PUT /api/gift-cards/:id
 * @access Merchant (Verified)
 */
export const updateGiftCard = async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const merchantId = authReq.authUser?.userId;
    const { id } = req.params;

    if (!merchantId) {
      return res.status(StatusCodes.UNAUTHORIZED).json(errorResponse("Unauthorized"));
    }

    // Validate request body
    const validatedData = updateGiftCardSchema.parse(req.body);

    // Check if gift card exists and belongs to merchant
    const existingCard = await prisma.giftCard.findUnique({
      where: { id },
    });

    if (!existingCard) {
      return res.status(StatusCodes.NOT_FOUND).json(errorResponse("Gift card not found"));
    }

    if (existingCard.merchantId !== merchantId) {
      return res.status(StatusCodes.FORBIDDEN).json(errorResponse("You do not have permission to update this gift card."));
    }


    // Prepare update data and track changes
    const updateData: any = {};
    const changes: Record<string, { from: any; to: any }> = {};
    
    if (validatedData.title !== undefined && validatedData.title !== existingCard.title) {
      updateData.title = validatedData.title;
      changes.title = { from: existingCard.title, to: validatedData.title };
    }
    if (validatedData.description !== undefined && validatedData.description !== existingCard.description) {
      updateData.description = validatedData.description;
      changes.description = { from: existingCard.description, to: validatedData.description };
    }
    if (validatedData.price !== undefined && validatedData.price !== existingCard.price.toNumber()) {
      updateData.price = new Decimal(validatedData.price);
      changes.price = { from: existingCard.price.toNumber(), to: validatedData.price };
    }
    if (validatedData.expiryDate !== undefined) {
      const newExpiry = new Date(validatedData.expiryDate);
      if (newExpiry.getTime() !== existingCard.expiryDate.getTime()) {
        updateData.expiryDate = newExpiry;
        changes.expiryDate = { from: existingCard.expiryDate, to: newExpiry };
      }
    }
    if (validatedData.isActive !== undefined && validatedData.isActive !== existingCard.isActive) {
      updateData.isActive = validatedData.isActive;
      changes.isActive = { from: existingCard.isActive, to: validatedData.isActive };
    }

    // Update gift card
    const giftCard = await prisma.giftCard.update({
      where: { id },
      data: updateData,
      include: {
        merchant: {
          select: {
            id: true,
            name: true,
            merchantProfile: {
              select: {
                businessName: true,
              },
            },
          },
        },
      },
    });

    if (Object.keys(changes).length > 0) {
      if (changes.isActive && changes.isActive.to === false) {
        await ActivityLogger.giftCardDeactivated(
          giftCard.id,
          merchantId,
          giftCard.title,
          req
        );
      } else {
        await ActivityLogger.giftCardUpdated(
          giftCard.id,
          merchantId,
          giftCard.title,
          changes,
          req
        );
      }
    }

    return res.status(StatusCodes.OK).json(successResponse("Gift card updated successfully", { giftCard }));

  } catch (error: any) {
    console.error('Update gift card error:', error);

    if (error.name === 'ZodError') {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.errors,
      });
    }

    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Internal server error',
      error: error.message,
    });
  }
};

/**
 * Delete a gift card
 * @route DELETE /api/gift-cards/:id
 * @access Merchant (Verified)
 */
export const deleteGiftCard = async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const merchantId = authReq.authUser?.userId;
    const { id } = req.params;

    if (!merchantId) {
      return res.status(StatusCodes.UNAUTHORIZED).json(errorResponse("Unauthorized"));
    }

    // Check if gift card exists and belongs to merchant
    const existingCard = await prisma.giftCard.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            purchases: true,
          },
        },
      },
    });

    if (!existingCard) {
      return res.status(StatusCodes.NOT_FOUND).json(errorResponse("Gift card not found."));
    }

    if (existingCard.merchantId !== merchantId) {
      return res.status(StatusCodes.FORBIDDEN).json(errorResponse("You do not have permission to delete this gift card."));
    }

    // Check if gift card has been purchased
    if (existingCard._count.purchases > 0) {

      await ActivityLogger.log({
        actorId: merchantId,
        actorType: 'merchant',
        action: 'delete_failed',
        category: 'GIFT_CARD',
        description: `Cannot delete gift card "${existingCard.title}" - has ${existingCard._count.purchases} purchases`,
        resourceType: 'gift_card',
        resourceId: id,
        metadata: { purchaseCount: existingCard._count.purchases },
        merchantId,
        severity: 'WARNING',
        req
      });
      return res.status(StatusCodes.BAD_REQUEST).json(errorResponse("Cannot delete gift card that has been purchased. You can deactivate it instead."));
    }

    // Delete gift card
    await prisma.giftCard.delete({
      where: { id },
    });

    await ActivityLogger.log({
      actorId: merchantId,
      actorType: 'merchant',
      action: 'deleted',
      category: 'GIFT_CARD',
      description: `Gift card "${existingCard.title}" deleted`,
      resourceType: 'gift_card',
      resourceId: id,
      metadata: { 
        title: existingCard.title, 
        price: existingCard.price.toNumber(),
        expiryDate: existingCard.expiryDate
      },
      merchantId,
      req
    });

    return res.status(StatusCodes.OK).json(successResponse("Gift card deleted successfully"));
  } catch (error: any) {

    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Internal server error',
      error: error.message,
    });
  }
};

/**
 * Get all active gift cards (Public - for customers to browse)
 * @route GET /api/gift-cards/public/active
 * @access Public
 */

export const getActiveGiftCards = async (req: Request, res: Response) => {
  try {
    const page = Math.max(parseInt(req.query.page as string) || 1, 1);
    const limit = Math.max(parseInt(req.query.limit as string) || 10, 1);
    const skip = (page - 1) * limit;

    // Search parameter
    const search = req.query.search as string;

    // Sort parameters
    const sortBy = (req.query.sortBy as string) || 'createdAt';
    const sortOrder = (req.query.sortOrder as string) === 'asc' ? 'asc' : 'desc';

    const whereClause: any = {
      isActive: true,
      expiryDate: {
        gt: new Date(), // Only non-expired cards
      },
    };

    // Add search filter if provided
    if (search) {
      whereClause.title = {
        contains: search,
        mode: 'insensitive', // Case-insensitive search
      };
    }

    // Validate and set orderBy
    const validSortFields = ['price', 'createdAt', 'expiryDate', 'title'];
    const orderByField = validSortFields.includes(sortBy) ? sortBy : 'createdAt';
    const orderBy: any = { [orderByField]: sortOrder };

    const [giftCards, total] = await Promise.all([
      prisma.giftCard.findMany({
        where: whereClause,
        skip,
        take: limit,
        orderBy,
        include: {
          merchant: {
            select: {
              id: true,
              name: true,
              merchantProfile: {
                select: {
                  businessName: true,
                  logo: true,
                  city: true,
                  country: true,
                },
              },
            },
          },
        },
      }),
      prisma.giftCard.count({
        where: whereClause,
      }),
    ]);

    return res.status(StatusCodes.OK).json(
      successResponse("Active gift cards fetched successfully.", {
        giftCards,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
        filters: {
          search: search || null,
          sortBy: orderByField,
          sortOrder,
        },
      })
    );
  } catch (error: any) {
    console.error("Get active gift cards error:", error);

    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};


export const createSettings = async (req:Request, res: Response) => {
  try {
    const userId = req.authUser?.userId;
    const { primaryColor, secondaryColor, gradientDirection, fontFamily } = req.body;
    const merchant = await prisma.merchantProfile.findUnique({
      where:{
        userId: userId
      }
    });
    if (!merchant){
      return res.status(StatusCodes.NOT_FOUND).json(errorResponse("Merchant not found with the given id."));
    }
    const findSettings = await prisma.settings.findUnique({
      where:{
        merchantId: merchant.id
      }
    });
    if (findSettings){
      return res.status(StatusCodes.BAD_REQUEST).json(errorResponse("Settings have already been created, please update it."));
    }
    const settings = await prisma.settings.create({
      data:{
        merchantId: merchant.id,
        primaryColor: primaryColor,
        secondaryColor: secondaryColor,
        gradientDirection: gradientDirection,
        fontFamily: fontFamily,
      }
    });
    if (!settings){
      return res.status(StatusCodes.BAD_REQUEST).json(successResponse("Coudln't create settings for gift card."));
    }   
    return res.status(StatusCodes.OK).json(successResponse("Created settings for gift card successfully.", settings));

  } catch (error: any) {
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: "Error creating settings",
      error: error.message
    })
  }
}

export const updateSettings = async (req: Request, res: Response) => {
  try {
    const userId = req.authUser?.userId;

    const merchant = await prisma.merchantProfile.findUnique({
      where: { userId },
    });

    if (!merchant) {
      return res.status(StatusCodes.NOT_FOUND).json(errorResponse("No merchant found with the given id."));
    }

    const parsed = udpateSettingSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        message: "Invalid settings data",
        errors: parsed.error.flatten().fieldErrors,
      });
    }

    const updateData = parsed.data;

    if (Object.keys(updateData).length === 0) {
      return res.status(StatusCodes.BAD_REQUEST).json(errorResponse("At least one field must be provided to update."));
    }

    const settings = await prisma.settings.update({
      where: { merchantId: merchant.id },
      data: updateData,
    });

    if (!settings){
      return res.status(StatusCodes.BAD_REQUEST).json(errorResponse("Your settings couldn't be updated."))
    }
    return res.status(StatusCodes.OK).json(successResponse("Settings updated successfully.", settings))

  } catch (error: any) {
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: "Error updating settings",
      error: error.message
    })
  }
}

export const getCardSetting = async (req: Request, res: Response) => {
  try {
    const userId = req.authUser?.userId;
    const merchant = await prisma.merchantProfile.findUnique({
      where: {
        userId: userId
      }
    });
    if (!merchant){
      return res.status(StatusCodes.BAD_REQUEST).json(errorResponse("No merchant found with given id."));
    }
    const settings = await prisma.settings.findFirst({
      where:{
        merchantId: merchant.id
      }
    });
    if (!settings){
      return res.status(StatusCodes.BAD_REQUEST).json(errorResponse("No settings available."));
    }
    return res.status(StatusCodes.OK).json(successResponse("Fetched card setting successfully.", settings))
  } catch (error: any) {
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: "Error fetching card settings",
      error: error.message
    })
  }
} 