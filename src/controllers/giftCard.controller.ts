
import { Request, Response } from 'express';
import { 
  createGiftCardSchema, 
  updateGiftCardSchema 
} from '../validators/giftCard.validator';
import prisma from '../utils/prisma.util';
import { Decimal } from '@prisma/client/runtime/library';
import { ActivityLogger } from '../services/activityLog.service';

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
      return res.status(401).json({
        success: false,
        message: 'Unauthorized',
      });
    }

    const merchant = await prisma.merchantProfile.findUnique({
      where:{
        userId: merchantId
      }
    });

    if (!merchant){
      return res.status(404).json({
        success: false,
        message: "Merchant not found with given Id."
      })
    }

    // Validate request body
    const validatedData = createGiftCardSchema.parse(req.body);

    // Check gift card limit (only count active cards)
    const existingCardsCount = await prisma.giftCard.count({
      where: { 
        merchantId,
        isActive: true // Only count active cards
      },
    });

    if (existingCardsCount >= merchant.giftCardLimit) {
      return res.status(400).json({
        success: false,
        message: `You have reached the maximum limit of ${merchant.giftCardLimit} active gift cards`,
      });
    }

    // Create gift card
    const giftCard = await prisma.giftCard.create({
      data: {
        merchantId,
        title: validatedData.title,
        description: validatedData.description,
        price: new Decimal(validatedData.price),
        expiryDate: new Date(validatedData.expiryDate),
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
      validatedData.price,
      req
    );

    return res.status(201).json({
      success: true,
      message: 'Gift card created successfully',
      data: { giftCard },
    });
  } catch (error: any) {
    console.error('Create gift card error:', error);

    if (error.name === 'ZodError') {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.errors,
      });
    }

    return res.status(500).json({
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
      return res.status(401).json({
        success: false,
        message: 'Unauthorized',
      });
    }
    const merchant = await prisma.merchantProfile.findUnique({
      where:{
        userId: merchantId
      }
    });

    if (!merchant){
      return res.status(404).json({
        success: false,
        message: "Merchant not found with given Id."
      })
    }
    const giftCards = await prisma.giftCard.findMany({
      where: { merchantId },
      orderBy: { createdAt: 'desc' },
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
            purchases: true, // Count how many times this card was purchased
          },
        },
      },
    });

    // Count only active cards for limit calculation
    const activeCardsCount = giftCards.filter(card => card.isActive).length;

    return res.status(200).json({
      success: true,
      data: { 
        giftCards,
        total: giftCards.length,
        activeCards: activeCardsCount,
        limit: merchant.giftCardLimit,
        remaining: Math.max(0, merchant.giftCardLimit - activeCardsCount),
      },
    });
  } catch (error: any) {
    console.error('Get gift cards error:', error);

    return res.status(500).json({
      success: false,
      message: 'Internal server error',
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
      return res.status(401).json({
        success: false,
        message: 'Unauthorized',
      });
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
      return res.status(404).json({
        success: false,
        message: 'Gift card not found',
      });
    }

    // Check if the gift card belongs to the merchant
    if (giftCard.merchantId !== merchantId) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to access this gift card',
      });
    }

    return res.status(200).json({
      success: true,
      data: { giftCard },
    });
  } catch (error: any) {
    console.error('Get gift card error:', error);

    return res.status(500).json({
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
      return res.status(401).json({
        success: false,
        message: 'Unauthorized',
      });
    }

    // Validate request body
    const validatedData = updateGiftCardSchema.parse(req.body);

    // Check if gift card exists and belongs to merchant
    const existingCard = await prisma.giftCard.findUnique({
      where: { id },
    });

    if (!existingCard) {
      return res.status(404).json({
        success: false,
        message: 'Gift card not found',
      });
    }

    if (existingCard.merchantId !== merchantId) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to update this gift card',
      });
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

    return res.status(200).json({
      success: true,
      message: 'Gift card updated successfully',
      data: { giftCard },
    });
  } catch (error: any) {
    console.error('Update gift card error:', error);

    if (error.name === 'ZodError') {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.errors,
      });
    }

    return res.status(500).json({
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
      return res.status(401).json({
        success: false,
        message: 'Unauthorized',
      });
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
      return res.status(404).json({
        success: false,
        message: 'Gift card not found',
      });
    }

    if (existingCard.merchantId !== merchantId) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to delete this gift card',
      });
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
      return res.status(400).json({
        success: false,
        message: 'Cannot delete gift card that has been purchased. You can deactivate it instead.',
      });
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

    return res.status(200).json({
      success: true,
      message: 'Gift card deleted successfully',
    });
  } catch (error: any) {
    console.error('Delete gift card error:', error);

    return res.status(500).json({
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
    const giftCards = await prisma.giftCard.findMany({
      where: {
        isActive: true,
        expiryDate: {
          gt: new Date(), // Only non-expired cards
        },
      },
      orderBy: { createdAt: 'desc' },
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
    });

    return res.status(200).json({
      success: true,
      data: { 
        giftCards,
        total: giftCards.length,
      },
    });
  } catch (error: any) {
    console.error('Get active gift cards error:', error);

    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message,
    });
  }
};