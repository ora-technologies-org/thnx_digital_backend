import express from "express";
import {
  login,
  refreshToken,
  getCurrentUser,
  logout,
} from "../controllers/auth.controller";
import { authenticate, authorize } from "../middleware/auth.middleware";
import { uploadMerchantDocs } from "../utils/multer";
import {
  completeProfile,
  merchantRegister,
} from "../controllers/merchant.controller";

const router = express.Router();

// ==================== Public Routes ====================

/**
 * @route   POST /api/auth/merchant/register
 * @desc    Quick merchant registration (minimal info)
 * @access  Public
 */
router.post("/merchant/register", merchantRegister);

/**
 * @route   POST /api/auth/login
 * @desc    Login user
 * @access  Public
 */
router.post("/login", login);

/**
 * @route   POST /api/auth/refresh
 * @desc    Refresh access token
 * @access  Public
 */
router.post("/refresh", refreshToken);

/**
 * @route   POST /api/auth/logout
 * @desc    Logout user
 * @access  Public
 */
router.post("/logout", logout);

// ==================== Protected Routes ====================

/**
 * @route   POST /api/auth/merchant/complete-profile
 * @desc    Complete merchant profile with documents
 * @access  Merchant
 */
router.post(
  "/merchant/complete-profile",
  authenticate,
  authorize("MERCHANT"),
  uploadMerchantDocs,
  completeProfile,
);

/**
 * @route   GET /api/auth/me
 * @desc    Get current user profile
 * @access  Private
 */
router.get("/me", authenticate, getCurrentUser);

export default router;
