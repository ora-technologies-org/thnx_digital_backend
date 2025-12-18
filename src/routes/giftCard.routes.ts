import express from 'express';
import {
  createGiftCard,
  getMyGiftCards,
  getGiftCardById,
  updateGiftCard,
  deleteGiftCard,
  getActiveGiftCards,
  createSettings,
  updateSettings,
} from '../controllers/giftCard.controller';
import {
  authenticate,
  authorize,
  requireVerification,
  requireCompleteProfile,
} from '../middleware/auth.middleware';

const router = express.Router();

// ==================== Public Routes ====================

/**
 * @route   GET /api/gift-cards/public/active
 * @desc    Get all active gift cards (for customers)
 * @access  Public
 */
router.get('/public/active', getActiveGiftCards);

// ==================== Protected Merchant Routes ====================

/**
 * @route   POST /api/gift-cards
 * @desc    Create a new gift card
 * @access  Merchant (Verified only)
 */
router.post(
  '/',
  authenticate,
  authorize('MERCHANT'),
  requireVerification, // Only verified merchants can create
  createGiftCard
);

/**
 * @route   GET /api/gift-cards
 * @desc    Get all gift cards for logged-in merchant
 * @access  Merchant (Profile complete)
 */
router.get(
  '/',
  authenticate,
  authorize('MERCHANT'),
  requireCompleteProfile, // Can view if profile submitted (even if pending)
  getMyGiftCards
);

/**
 * @route   GET /api/gift-cards/:id
 * @desc    Get a single gift card by ID
 * @access  Merchant (Profile complete)
 */
router.get(
  '/:id',
  authenticate,
  authorize('MERCHANT'),
  requireCompleteProfile,
  getGiftCardById
);

/**
 * @route   PUT /api/gift-cards/:id
 * @desc    Update a gift card
 * @access  Merchant (Verified only)
 */
router.put(
  '/:id',
  authenticate,
  authorize('MERCHANT'),
  requireVerification, // Only verified merchants can update
  updateGiftCard
);

/**
 * @route   DELETE /api/gift-cards/:id
 * @desc    Delete a gift card
 * @access  Merchant (Verified only)
 */
router.delete(
  '/:id',
  authenticate,
  authorize('MERCHANT'),
  requireVerification, // Only verified merchants can delete
  deleteGiftCard
);


router.post("/settings", authenticate, authorize("MERCHANT"), createSettings);
router.put("/card/settings", authenticate, authorize("MERCHANT"), updateSettings);


export default router;