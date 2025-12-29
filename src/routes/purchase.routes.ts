import express from 'express';
import {
  purchaseGiftCard,
  getGiftCardByQR,
  redeemGiftCard,
  getRedemptionHistory,
  getCustomerPurchases,
  requestOtp,
  verifyOtp,
  qrRedemptionHistory,
} from '../controllers/purchase.controller';
import {
  authenticate,
  authorize,
  requireVerification,
} from '../middleware/auth.middleware';
import { validate } from '../middleware/validation.middleware';
import { purchaseGiftCardSchema, redeemGiftCardSchema } from '../validators/purchase.validator';

const router = express.Router();

// ==================== Public Routes ====================

/**
 * @route   POST /api/purchases/gift-cards/:giftCardId
 * @desc    Purchase a gift card (no login required)
 * @access  Public
 */
router.post('/gift-cards/:giftCardId', validate(purchaseGiftCardSchema), purchaseGiftCard);

/**
 * @route   GET /api/purchases/qr/:qrCode
 * @desc    Get gift card details by QR code
 * @access  Public
 */
router.get('/qr/:qrCode', getGiftCardByQR);

/**
 * @route   GET /api/purchases/customer/:email
 * @desc    Get customer's purchase history by email
 * @access  Public
 */
router.get('/customer/:email', getCustomerPurchases);

// ==================== Merchant Routes ====================

/**
 * @route   POST /api/purchases/redeem
 * @desc    Redeem/use gift card (scan QR and subtract amount)
 * @access  Merchant (Verified only)
 */
router.post(
  '/redeem',
  authenticate,
  authorize('MERCHANT'),
  requireVerification, // Only verified merchants can redeem
  validate(redeemGiftCardSchema),
  redeemGiftCard
);

/**
 * @route   GET /api/purchases/redemptions
 * @desc    Get merchant's redemption history
 * @access  Merchant (Verified only)
 */
router.get(
  '/redemptions',
  authenticate, // FIXED: Was commented out
  authorize('MERCHANT'),
  requireVerification, // Only verified merchants can view history
  getRedemptionHistory
);

router.post("/otp/request-otp", authenticate, authorize("MERCHANT"), requestOtp);
router.post("/otp/verify-otp", authenticate, authorize("MERCHANT"), verifyOtp);
router.get("/redemptions/history", authenticate, authorize("MERCHANT"), qrRedemptionHistory);

export default router;