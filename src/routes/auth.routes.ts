// src/routes/auth.routes.ts

import express from "express";
import {
  login,
  refreshToken,
  getCurrentUser,
  logout,
  getOtp,
  verifyOtp,
  changePassword,
  googleLogin,
  resetPassword,
  resetAdminPassword,
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
 * @swagger
 * /api/auth/merchant/register:
 *   post:
 *     summary: Quick merchant registration
 *     description: Register a new merchant with minimal information (Step 1)
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/MerchantQuickRegisterRequest'
 *     responses:
 *       201:
 *         description: Registration successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Registration successful! Please complete your profile to get verified.
 *                 data:
 *                   type: object
 *                   properties:
 *                     user:
 *                       $ref: '#/components/schemas/User'
 *                     tokens:
 *                       type: object
 *                       properties:
 *                         accessToken:
 *                           type: string
 *                         refreshToken:
 *                           type: string
 *       400:
 *         description: User already exists or validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.post("/merchant/register", merchantRegister);

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Login user
 *     description: Login with email and password (Admin, Merchant, or User)
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/LoginRequest'
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthResponse'
 *       400:
 *         description: Validation error or OAuth account
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: Invalid email or password
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: Account deactivated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: Your account has been deactivated. Contact support.
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.post("/login", login);

/**
 * @swagger
 * /api/auth/refresh:
 *   post:
 *     summary: Refresh access token
 *     description: Get new access token using refresh token
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - refreshToken
 *             properties:
 *               refreshToken:
 *                 type: string
 *                 description: The refresh token received during login
 *                 example: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 *     responses:
 *       200:
 *         description: Token refreshed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Token refreshed successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     tokens:
 *                       type: object
 *                       properties:
 *                         accessToken:
 *                           type: string
 *                         refreshToken:
 *                           type: string
 *       400:
 *         description: Refresh token is required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: Invalid or expired refresh token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post("/refresh", refreshToken);

/**
 * @swagger
 * /api/auth/logout:
 *   post:
 *     summary: Logout user
 *     description: Invalidate refresh token and logout
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - refreshToken
 *             properties:
 *               refreshToken:
 *                 type: string
 *                 description: The refresh token to invalidate
 *                 example: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 *     responses:
 *       200:
 *         description: Logout successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Logout successful
 *       400:
 *         description: Refresh token is required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.post("/logout", logout);

// ==================== Protected Routes ====================

/**
 * @swagger
 * /api/auth/merchant/complete-profile:
 *   post:
 *     summary: Complete merchant profile
 *     description: Complete merchant profile with full details and documents (Step 2)
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - address
 *               - city
 *               - country
 *               - businessPhone
 *               - businessEmail
 *               - bankName
 *               - accountNumber
 *               - accountHolderName
 *               - identityDocument
 *             properties:
 *               businessRegistrationNumber:
 *                 type: string
 *                 example: REG123456
 *               taxId:
 *                 type: string
 *                 example: TAX123456
 *               businessType:
 *                 type: string
 *                 example: LLC
 *               businessCategory:
 *                 type: string
 *                 example: Retail
 *               address:
 *                 type: string
 *                 example: 123 Business Ave
 *               city:
 *                 type: string
 *                 example: New York
 *               state:
 *                 type: string
 *                 example: NY
 *               zipCode:
 *                 type: string
 *                 example: "10001"
 *               country:
 *                 type: string
 *                 example: USA
 *               businessPhone:
 *                 type: string
 *                 example: "+1234567890"
 *               businessEmail:
 *                 type: string
 *                 format: email
 *                 example: business@example.com
 *               website:
 *                 type: string
 *                 example: https://mybusiness.com
 *               description:
 *                 type: string
 *                 example: A great business serving customers
 *               bankName:
 *                 type: string
 *                 example: Chase Bank
 *               accountNumber:
 *                 type: string
 *                 example: "1234567890"
 *               accountHolderName:
 *                 type: string
 *                 example: John Smith
 *               ifscCode:
 *                 type: string
 *                 example: CHASUS33
 *               swiftCode:
 *                 type: string
 *                 example: CHASUS33XXX
 *               identityDocument:
 *                 type: string
 *                 format: binary
 *                 description: Required - Identity document (passport, ID card, etc.)
 *               registrationDocument:
 *                 type: string
 *                 format: binary
 *                 description: Optional - Business registration document
 *               taxDocument:
 *                 type: string
 *                 format: binary
 *                 description: Optional - Tax registration document
 *               additionalDocuments:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: binary
 *                 description: Optional - Additional supporting documents
 *     responses:
 *       200:
 *         description: Profile submitted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Profile submitted successfully! Waiting for admin verification.
 *                 data:
 *                   type: object
 *                   properties:
 *                     profile:
 *                       $ref: '#/components/schemas/MerchantProfile'
 *                     tokens:
 *                       type: object
 *                       properties:
 *                         accessToken:
 *                           type: string
 *                         refreshToken:
 *                           type: string
 *       400:
 *         description: Validation error or identity document missing
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         description: Only merchants can complete profile or profile already verified
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: Merchant profile not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.post(
  "/merchant/complete-profile",
  authenticate,
  authorize("MERCHANT"),
  uploadMerchantDocs,
  completeProfile
);

/**
 * @swagger
 * /api/auth/me:
 *   get:
 *     summary: Get current user profile
 *     description: Get the authenticated user's profile information
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User profile retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     user:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: string
 *                           format: uuid
 *                         email:
 *                           type: string
 *                           format: email
 *                         name:
 *                           type: string
 *                         phone:
 *                           type: string
 *                           nullable: true
 *                         role:
 *                           type: string
 *                           enum: [USER, MERCHANT, ADMIN]
 *                         avatar:
 *                           type: string
 *                           nullable: true
 *                         bio:
 *                           type: string
 *                           nullable: true
 *                         emailVerified:
 *                           type: boolean
 *                         isActive:
 *                           type: boolean
 *                         createdAt:
 *                           type: string
 *                           format: date-time
 *                         lastLogin:
 *                           type: string
 *                           format: date-time
 *                           nullable: true
 *                         merchantProfile:
 *                           $ref: '#/components/schemas/MerchantProfile'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       404:
 *         description: User not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get("/me", authenticate, getCurrentUser);


router.post("/get-otp", getOtp);
router.post("/verify-otp", verifyOtp);
router.post("/reset-password", changePassword);

router.post("/google-login", googleLogin);

router.post("/change-password", resetPassword);
router.post("/admin-password",authenticate, authorize("ADMIN"), resetAdminPassword);

export default router;