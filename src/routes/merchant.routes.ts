import express from "express";
import {
  getMerchantProfile,
  updateMerchantProfile,
  resubmitProfile,
  adminCreateMerchant,
  getAllMerchants,
  getPendingMerchants,
  verifyMerchant,
} from "../controllers/merchant.controller";
import {
  authenticate,
  authorize,
  requireCompleteProfile,
} from "../middleware/auth.middleware";
import { uploadMerchantDocs } from "../utils/multer";

const router = express.Router();

/**
 * @route   GET /api/merchant/profile
 * @desc    Get merchant's own profile with stats
 * @access  Merchant
 */
router.get("/profile", authenticate, authorize("MERCHANT"), getMerchantProfile);

/**
 * @route   PUT /api/merchant/profile
 * @desc    Update merchant profile (non-critical fields only)
 * @access  Merchant (Profile complete)
 */
router.put(
  "/profile",
  authenticate,
  authorize("MERCHANT"),
  requireCompleteProfile,
  updateMerchantProfile,
);

/**
 * @route   POST /api/merchant/resubmit
 * @desc    Resubmit profile after rejection
 * @access  Merchant (Rejected status only)
 */
router.post(
  "/resubmit",
  authenticate,
  authorize("MERCHANT"),
  uploadMerchantDocs,
  resubmitProfile,
);

// ==================== Admin Routes ====================

router.post(
  "/admin/create-merchant",
  authenticate,
  authorize("ADMIN"),
  adminCreateMerchant,
);

router.get(
  "/admin/merchants",
  authenticate,
  authorize("ADMIN"),
  getAllMerchants,
);

router.get(
  "/admin/merchants/pending",
  authenticate,
  authorize("ADMIN"),
  getPendingMerchants,
);

router.post(
  "/admin/merchants/:merchantId/verify",
  authenticate,
  authorize("ADMIN"),
  verifyMerchant,
);

export default router;
