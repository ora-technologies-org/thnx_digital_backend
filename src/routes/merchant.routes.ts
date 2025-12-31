import express from "express";
import {
  getMerchantProfile,
  updateMerchantProfile,
  resubmitProfile,
  adminCreateMerchant,
  getAllMerchants,
  getPendingMerchants,
  verifyMerchant,
  deleteMerchant,
  updateMerchantData,
  adminUpdateMerchant,
  getMerchantById,
  getGiftCardByMerchant,
  getVerifiedMerchants,
  getOverallAnalytics,
  generateAnalyticsPDF,
  createSupportTicket,
  getAllSupportTickets,
  getSupportTicketById,
  updateSupportTicket,
  getPurchaseOrders,
} from "../controllers/merchant.controller";
import {
  authenticate,
  authorize,
  requireCompleteProfile,
} from "../middleware/auth.middleware";
import { uploadMerchantDocs } from "../utils/multer";
import { updateProfile } from "../controllers/admin.controller";
import { queryValidation, validate } from "../middleware/validation.middleware";
import { adminCreateMerchantSchema, adminUpdateMerchantSchema, updateMerchantDataSchema } from "../validators/auth.validator";
import { createSupportTicketSchema, merchantVerifySchema, updateSupportTicketSchema } from "../validators/user.validator";
import { getMerchantDashboardStats } from "../controllers/analytics.controller";
import { getMerchantsQuerySchema, getPendingMerchantsQuerySchema, getPurchaseOrdersQuerySchema, getSupportTicketsQuerySchema, getVerifiedMerchantsQuerySchema } from "../validators/query.validators";
import { updateAdminProfileSchema } from "../validators/admin.validators";

const router = express.Router();

// ==================== Merchant Self-Service Routes ====================

/**
 * @swagger
 * /api/merchants/profile:
 *   get:
 *     summary: Get merchant profile
 *     description: Get the authenticated merchant's own profile with completion stats
 *     tags: [Merchants - Self Service]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Profile retrieved successfully
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
 *                     profile:
 *                       $ref: '#/components/schemas/MerchantProfile'
 *                     stats:
 *                       type: object
 *                       properties:
 *                         completionPercentage:
 *                           type: number
 *                           example: 100
 *                         missingFields:
 *                           type: array
 *                           items:
 *                             type: string
 *                           example: []
 *                         isComplete:
 *                           type: boolean
 *                           example: true
 *                         isPending:
 *                           type: boolean
 *                           example: false
 *                         isVerified:
 *                           type: boolean
 *                           example: true
 *                         isRejected:
 *                           type: boolean
 *                           example: false
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get("/profile", authenticate, authorize("MERCHANT"), getMerchantProfile);

/**
 * @swagger
 * /api/merchants/profile:
 *   put:
 *     summary: Update merchant profile
 *     description: Update non-critical profile fields (description, website, logo)
 *     tags: [Merchants - Self Service]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateProfileRequest'
 *     responses:
 *       200:
 *         description: Profile updated successfully
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
 *                   example: Profile updated successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     profile:
 *                       $ref: '#/components/schemas/MerchantProfile'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.put(
  "/profile",
  authenticate,
  authorize("MERCHANT"),
  requireCompleteProfile,
  updateMerchantProfile
);

/**
 * @swagger
 * /api/merchants/resubmit:
 *   post:
 *     summary: Resubmit profile after rejection
 *     description: Resubmit profile with updated info and documents after rejection
 *     tags: [Merchants - Self Service]
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
 *             properties:
 *               businessRegistrationNumber:
 *                 type: string
 *               taxId:
 *                 type: string
 *               businessType:
 *                 type: string
 *               businessCategory:
 *                 type: string
 *               address:
 *                 type: string
 *               city:
 *                 type: string
 *               state:
 *                 type: string
 *               zipCode:
 *                 type: string
 *               country:
 *                 type: string
 *               businessPhone:
 *                 type: string
 *               businessEmail:
 *                 type: string
 *                 format: email
 *               website:
 *                 type: string
 *               description:
 *                 type: string
 *               bankName:
 *                 type: string
 *               accountNumber:
 *                 type: string
 *               accountHolderName:
 *                 type: string
 *               ifscCode:
 *                 type: string
 *               swiftCode:
 *                 type: string
 *               identityDocument:
 *                 type: string
 *                 format: binary
 *               registrationDocument:
 *                 type: string
 *                 format: binary
 *               taxDocument:
 *                 type: string
 *                 format: binary
 *               additionalDocuments:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: binary
 *     responses:
 *       200:
 *         description: Profile resubmitted successfully
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
 *                   example: Profile resubmitted successfully! Waiting for admin verification.
 *                 data:
 *                   type: object
 *                   properties:
 *                     profile:
 *                       $ref: '#/components/schemas/MerchantProfile'
 *       400:
 *         description: Bad request - Profile not in rejected status
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
 *                   example: "Cannot resubmit profile. Current status: VERIFIED"
 *                 profileStatus:
 *                   type: string
 *                   example: VERIFIED
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.post(
  "/resubmit",
  authenticate,
  authorize("MERCHANT"),
  uploadMerchantDocs,
  resubmitProfile
);

// ==================== Admin Routes ====================

/**
 * @swagger
 * /api/merchants:
 *   post:
 *     summary: Create merchant (Admin)
 *     description: Admin creates a new merchant account (auto-verified)
 *     tags: [Merchants - Admin]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateMerchantRequest'
 *     responses:
 *       201:
 *         description: Merchant created successfully
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
 *                   example: Merchant created and verified successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     user:
 *                       $ref: '#/components/schemas/User'
 *       400:
 *         description: User with this email already exists
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.post("/", authenticate, authorize("ADMIN"), uploadMerchantDocs, validate(adminCreateMerchantSchema), adminCreateMerchant);

/**
 * @swagger
 * /api/merchants:
 *   get:
 *     summary: Get all merchants (Admin)
 *     description: Get list of all merchants
 *     tags: [Merchants - Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Merchants retrieved successfully
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
 *                     merchants:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/MerchantProfile'
 *                     count:
 *                       type: number
 *                       example: 10
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get("/", authenticate, authorize("ADMIN"), queryValidation(getMerchantsQuerySchema), getAllMerchants);

/**
 * @swagger
 * /api/merchants/pending:
 *   get:
 *     summary: Get pending merchants (Admin)
 *     description: Get all merchants awaiting verification
 *     tags: [Merchants - Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Pending merchants retrieved successfully
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
 *                     merchants:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/MerchantProfile'
 *                     count:
 *                       type: number
 *                       example: 5
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get("/pending", authenticate, authorize("ADMIN"), queryValidation(getPendingMerchantsQuerySchema), getPendingMerchants);

/**
 * @swagger
 * /api/merchants/{merchantId}/verify:
 *   post:
 *     summary: Verify or reject merchant (Admin)
 *     description: Approve or reject a merchant's verification request
 *     tags: [Merchants - Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: merchantId
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID of the merchant
 *         example: clxx1234567890
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/VerifyMerchantRequest'
 *     responses:
 *       200:
 *         description: Merchant verified/rejected successfully
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
 *                   example: Merchant approved successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     profile:
 *                       $ref: '#/components/schemas/MerchantProfile'
 *       400:
 *         description: Invalid action or missing rejection reason
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.post(
  "/:merchantId/verify",
  authenticate,
  authorize("ADMIN"),
  validate(merchantVerifySchema),
  verifyMerchant
);

/**
 * @swagger
 * /api/merchants/{merchantId}:
 *   delete:
 *     summary: Delete merchant (Admin)
 *     description: Soft delete (deactivate) or hard delete (permanent) a merchant
 *     tags: [Merchants - Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: merchantId
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID of the merchant
 *         example: clxx1234567890
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/DeleteMerchantRequest'
 *     responses:
 *       200:
 *         description: Merchant deleted/deactivated successfully
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
 *                   example: Merchant deactivated successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     merchantId:
 *                       type: string
 *                       example: clxx1234567890
 *                     email:
 *                       type: string
 *                       example: merchant@example.com
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.delete(
  "/:merchantId",
  authenticate,
  authorize("ADMIN"),
  deleteMerchant
);

/**
 * @swagger
 * /api/merchants/:
 *   put:
 *     summary: Update merchant profile (Self-service)
 *     description: Allows merchants to update their own profile. Profile status will be set to PENDING_VERIFICATION after update. Verified profiles cannot be updated.
 *     tags: [Merchants - Self Service]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               businessName:
 *                 type: string
 *                 example: "Updated Business Name"
 *               businessRegistrationNumber:
 *                 type: string
 *                 example: "REG987654"
 *               taxId:
 *                 type: string
 *                 example: "TAX987654"
 *               businessType:
 *                 type: string
 *                 example: "Corporation"
 *               businessCategory:
 *                 type: string
 *                 example: "Food & Beverage"
 *               address:
 *                 type: string
 *                 example: "456 Business Blvd"
 *               city:
 *                 type: string
 *                 example: "Los Angeles"
 *               state:
 *                 type: string
 *                 example: "CA"
 *               zipCode:
 *                 type: string
 *                 example: "90001"
 *               country:
 *                 type: string
 *                 example: "USA"
 *               businessPhone:
 *                 type: string
 *                 example: "+1234567890"
 *               businessEmail:
 *                 type: string
 *                 format: email
 *                 example: "updated@business.com"
 *               website:
 *                 type: string
 *                 example: "https://updatedbusiness.com"
 *               description:
 *                 type: string
 *                 example: "Updated business description"
 *               bankName:
 *                 type: string
 *                 example: "Bank of America"
 *               accountNumber:
 *                 type: string
 *                 example: "1234567890"
 *               accountHolderName:
 *                 type: string
 *                 example: "John Doe"
 *               ifscCode:
 *                 type: string
 *                 example: "IFSC0001234"
 *               swiftCode:
 *                 type: string
 *                 example: "SWIFT123"
 *               registrationDocument:
 *                 type: string
 *                 format: binary
 *                 description: Business registration document
 *               taxDocument:
 *                 type: string
 *                 format: binary
 *                 description: Tax document
 *               identityDocument:
 *                 type: string
 *                 format: binary
 *                 description: Identity proof document
 *               businessLogo:
 *                 type: string
 *                 format: binary
 *                 description: Business logo image
 *               additionalDocuments:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: binary
 *                 description: Additional supporting documents
 *     responses:
 *       200:
 *         description: Profile updated successfully
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
 *                   example: "Profile updated successfully"
 *                 data:
 *                   $ref: '#/components/schemas/MerchantProfile'
 *       400:
 *         description: Bad request - Profile already verified or registration number in use
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
 *                   example: "Profile verified. Therefore, couldn't be updated."
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.put("/", authenticate, authorize("MERCHANT"), uploadMerchantDocs, validate(updateMerchantDataSchema), updateMerchantData);

/**
 * @swagger
 * /api/merchants/{merchantId}:
 *   put:
 *     summary: Update merchant profile (Admin)
 *     description: Allows admin to update any verified merchant's profile. Only verified profiles can be updated by admin and will remain verified after update.
 *     tags: [Merchants - Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: merchantId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Merchant user ID
 *         example: "550e8400-e29b-41d4-a716-446655440000"
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               businessName:
 *                 type: string
 *                 example: "Updated Business Name"
 *               businessRegistrationNumber:
 *                 type: string
 *                 example: "REG987654"
 *               taxId:
 *                 type: string
 *                 example: "TAX987654"
 *               businessType:
 *                 type: string
 *                 example: "Corporation"
 *               businessCategory:
 *                 type: string
 *                 example: "Food & Beverage"
 *               address:
 *                 type: string
 *                 example: "456 Business Blvd"
 *               city:
 *                 type: string
 *                 example: "Los Angeles"
 *               state:
 *                 type: string
 *                 example: "CA"
 *               zipCode:
 *                 type: string
 *                 example: "90001"
 *               country:
 *                 type: string
 *                 example: "USA"
 *               businessPhone:
 *                 type: string
 *                 example: "+1234567890"
 *               businessEmail:
 *                 type: string
 *                 format: email
 *                 example: "updated@business.com"
 *               website:
 *                 type: string
 *                 example: "https://updatedbusiness.com"
 *               description:
 *                 type: string
 *                 example: "Updated business description"
 *               bankName:
 *                 type: string
 *                 example: "Bank of America"
 *               accountNumber:
 *                 type: string
 *                 example: "1234567890"
 *               accountHolderName:
 *                 type: string
 *                 example: "John Doe"
 *               ifscCode:
 *                 type: string
 *                 example: "IFSC0001234"
 *               swiftCode:
 *                 type: string
 *                 example: "SWIFT123"
 *               registrationDocument:
 *                 type: string
 *                 format: binary
 *                 description: Business registration document
 *               taxDocument:
 *                 type: string
 *                 format: binary
 *                 description: Tax document
 *               identityDocument:
 *                 type: string
 *                 format: binary
 *                 description: Identity proof document
 *               businessLogo:
 *                 type: string
 *                 format: binary
 *                 description: Business logo image
 *               additionalDocuments:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: binary
 *                 description: Additional supporting documents
 *     responses:
 *       200:
 *         description: Profile updated successfully
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
 *                   example: "Profile updated successfully."
 *                 data:
 *                   $ref: '#/components/schemas/MerchantProfile'
 *       400:
 *         description: Bad request - Merchant not verified
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
 *                   example: "This merchant profile cannot be updated at its current status."
 *       404:
 *         description: Merchant profile not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.put("/:merchantId", authenticate, authorize("ADMIN"), uploadMerchantDocs, validate(adminUpdateMerchantSchema), adminUpdateMerchant);


// router.get("/:merchantId", authenticate, authorize("ADMIN"), getMerchantById);

/**
 * @swagger
 * /api/merchants/cards/{merchantId}:
 *   get:
 *     summary: Get all gift cards by merchant
 *     description: Retrieves all gift cards for a specific merchant with pagination, search, and sorting
 *     tags: [Merchants - Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: merchantId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Merchant user ID
 *         example: "550e8400-e29b-41d4-a716-446655440000"
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Page number
 *         example: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 10
 *         description: Number of items per page
 *         example: 10
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search by gift card title or description
 *         example: "Holiday"
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [price, createdAt, updatedAt, expiryDate, title, isActive, status]
 *           default: createdAt
 *         description: Field to sort by
 *         example: "createdAt"
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
 *         description: Sort order
 *         example: "desc"
 *     responses:
 *       200:
 *         description: Gift cards fetched successfully
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
 *                   example: "Gift cards fetched successfully."
 *                 data:
 *                   type: object
 *                   properties:
 *                     giftCards:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/GiftCard'
 *                     setting:
 *                       type: object
 *                       nullable: true
 *                       description: Merchant's gift card settings
 *                     pagination:
 *                       type: object
 *                       properties:
 *                         total:
 *                           type: number
 *                           example: 50
 *                         page:
 *                           type: number
 *                           example: 1
 *                         limit:
 *                           type: number
 *                           example: 10
 *                         totalPages:
 *                           type: number
 *                           example: 5
 *                     filters:
 *                       type: object
 *                       properties:
 *                         search:
 *                           type: string
 *                           nullable: true
 *                           example: "Holiday"
 *                         sortBy:
 *                           type: string
 *                           example: "createdAt"
 *                         sortOrder:
 *                           type: string
 *                           example: "desc"
 *       404:
 *         description: Merchant not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get("/cards/:merchantId", authenticate, authorize("ADMIN"), getGiftCardByMerchant);

/**
 * @swagger
 * /api/merchants/all/verified:
 *   get:
 *     summary: Get all verified merchants
 *     description: Retrieves all verified merchants with pagination, search, sorting, and statistics
 *     tags: [Merchants - Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Page number
 *         example: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 10
 *         description: Number of items per page
 *         example: 10
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search by business name, email, type, category, city, state, country, description, or user details
 *         example: "Coffee Shop"
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [createdAt, updatedAt, businessName, city, state, country, verifiedAt, giftCardLimit]
 *           default: createdAt
 *         description: Field to sort by
 *         example: "createdAt"
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
 *         description: Sort order
 *         example: "desc"
 *     responses:
 *       200:
 *         description: Verified merchants fetched successfully
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
 *                   example: "Verified merchants fetched successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     merchants:
 *                       type: array
 *                       items:
 *                         allOf:
 *                           - $ref: '#/components/schemas/MerchantProfile'
 *                           - type: object
 *                             properties:
 *                               user:
 *                                 type: object
 *                                 properties:
 *                                   id:
 *                                     type: string
 *                                     format: uuid
 *                                   email:
 *                                     type: string
 *                                   name:
 *                                     type: string
 *                                   phone:
 *                                     type: string
 *                                   isActive:
 *                                     type: boolean
 *                                   createdAt:
 *                                     type: string
 *                                     format: date-time
 *                               _count:
 *                                 type: object
 *                                 properties:
 *                                   supportTicket:
 *                                     type: number
 *                                     example: 3
 *                     pagination:
 *                       type: object
 *                       properties:
 *                         total:
 *                           type: number
 *                           example: 45
 *                         page:
 *                           type: number
 *                           example: 1
 *                         limit:
 *                           type: number
 *                           example: 10
 *                         totalPages:
 *                           type: number
 *                           example: 5
 *                     filters:
 *                       type: object
 *                       properties:
 *                         search:
 *                           type: string
 *                           nullable: true
 *                           example: "Coffee Shop"
 *                         sortBy:
 *                           type: string
 *                           example: "createdAt"
 *                         sortOrder:
 *                           type: string
 *                           example: "desc"
 *                     stats:
 *                       type: object
 *                       properties:
 *                         totalVerified:
 *                           type: number
 *                           example: 45
 *                           description: Total number of verified merchants
 *                         activeVerified:
 *                           type: number
 *                           example: 40
 *                           description: Number of active verified merchants
 *                         inactiveVerified:
 *                           type: number
 *                           example: 5
 *                           description: Number of inactive verified merchants
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get("/all/verified", authenticate, authorize("ADMIN"), queryValidation(getVerifiedMerchantsQuerySchema), getVerifiedMerchants);

router.get("/analytics/business", authenticate, authorize("ADMIN"), getOverallAnalytics);
router.get("/analytics/report", authenticate, authorize("ADMIN"), generateAnalyticsPDF);


/**
 * @swagger
 * /api/merchants/support-ticket:
 *   post:
 *     summary: Create support ticket
 *     description: Allows merchants to create a support ticket for admin assistance
 *     tags: [Merchants - Self Service]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *               - query
 *             properties:
 *               title:
 *                 type: string
 *                 example: "Issue with gift card creation"
 *               query:
 *                 type: string
 *                 example: "I'm unable to create gift cards. Getting an error when I try to upload images."
 *     responses:
 *       200:
 *         description: Support ticket created successfully
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
 *                   example: "Support ticket created succesfully."
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       format: uuid
 *                     merchantId:
 *                       type: string
 *                       format: uuid
 *                     title:
 *                       type: string
 *                       example: "Issue with gift card creation"
 *                     merchantQuery:
 *                       type: string
 *                       example: "I'm unable to create gift cards."
 *                     adminResponse:
 *                       type: string
 *                       nullable: true
 *                     status:
 *                       type: string
 *                       enum: [OPEN, IN_PROGRESS, RESOLVED, CLOSED]
 *                       example: "OPEN"
 *                     createdAt:
 *                       type: string
 *                       format: date-time
 *                     updatedAt:
 *                       type: string
 *                       format: date-time
 *       400:
 *         description: Failed to create support ticket
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: Merchant not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.post("/support-ticket", authenticate, authorize("MERCHANT"), validate(createSupportTicketSchema), createSupportTicket);


/**
 * @swagger
 * /api/merchants/support-ticket:
 *   get:
 *     summary: Get all support tickets
 *     description: Retrieves all support tickets with pagination, search, and sorting. Admin only.
 *     tags: [Merchants - Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Page number
 *         example: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 10
 *         description: Number of items per page
 *         example: 10
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search by ticket title, business name, merchant name, or merchant email
 *         example: "Issue with"
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [createdAt, updatedAt, status, priority, title]
 *           default: createdAt
 *         description: Field to sort by
 *         example: "createdAt"
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
 *         description: Sort order
 *         example: "desc"
 *     responses:
 *       200:
 *         description: Support tickets fetched successfully
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
 *                   example: "Fetched support tickets successfully."
 *                 data:
 *                   type: object
 *                   properties:
 *                     data:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                             format: uuid
 *                           merchantId:
 *                             type: string
 *                             format: uuid
 *                           title:
 *                             type: string
 *                             example: "Issue with gift card creation"
 *                           merchantQuery:
 *                             type: string
 *                           adminResponse:
 *                             type: string
 *                             nullable: true
 *                           status:
 *                             type: string
 *                             enum: [OPEN, IN_PROGRESS, RESOLVED, CLOSED]
 *                           priority:
 *                             type: string
 *                             enum: [LOW, MEDIUM, HIGH, URGENT]
 *                           createdAt:
 *                             type: string
 *                             format: date-time
 *                           updatedAt:
 *                             type: string
 *                             format: date-time
 *                           merchant:
 *                             type: object
 *                             properties:
 *                               id:
 *                                 type: string
 *                                 format: uuid
 *                               businessName:
 *                                 type: string
 *                                 example: "Acme Corporation"
 *                               user:
 *                                 type: object
 *                                 properties:
 *                                   id:
 *                                     type: string
 *                                     format: uuid
 *                                   name:
 *                                     type: string
 *                                   email:
 *                                     type: string
 *                                     format: email
 *                     pagination:
 *                       type: object
 *                       properties:
 *                         total:
 *                           type: number
 *                           example: 25
 *                         page:
 *                           type: number
 *                           example: 1
 *                         limit:
 *                           type: number
 *                           example: 10
 *                         totalPages:
 *                           type: number
 *                           example: 3
 *                     filters:
 *                       type: object
 *                       properties:
 *                         search:
 *                           type: string
 *                           nullable: true
 *                           example: "Issue with"
 *                         sortBy:
 *                           type: string
 *                           example: "createdAt"
 *                         sortOrder:
 *                           type: string
 *                           example: "desc"
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get("/support-ticket", authenticate, authorize("ADMIN"), queryValidation(getSupportTicketsQuerySchema), getAllSupportTickets);


/**
 * @swagger
 * /api/merchants/support-ticket/{ticketId}:
 *   get:
 *     summary: Get support ticket by ID
 *     description: Retrieves a specific support ticket with merchant details. Admin only.
 *     tags: [Merchants - Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: ticketId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Support ticket ID
 *         example: "550e8400-e29b-41d4-a716-446655440000"
 *     responses:
 *       200:
 *         description: Support ticket fetched successfully
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
 *                   example: "Support ticket fetched successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       format: uuid
 *                     title:
 *                       type: string
 *                       example: "Issue with gift card creation"
 *                     merchantQuery:
 *                       type: string
 *                       example: "I'm unable to create gift cards."
 *                     adminResponse:
 *                       type: string
 *                       nullable: true
 *                       example: "Please ensure all required fields are filled."
 *                     status:
 *                       type: string
 *                       enum: [OPEN, IN_PROGRESS, RESOLVED, CLOSED]
 *                       example: "IN_PROGRESS"
 *                     createdAt:
 *                       type: string
 *                       format: date-time
 *                     updatedAt:
 *                       type: string
 *                       format: date-time
 *                     merchant:
 *                       type: object
 *                       properties:
 *                         businessName:
 *                           type: string
 *                           example: "Acme Corporation"
 *                         businessEmail:
 *                           type: string
 *                           format: email
 *                           example: "contact@acme.com"
 *                         user:
 *                           type: object
 *                           properties:
 *                             name:
 *                               type: string
 *                               example: "John Doe"
 *                             email:
 *                               type: string
 *                               format: email
 *                               example: "john@acme.com"
 *       404:
 *         description: Support ticket not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get("/support-ticket/:ticketId", authenticate, authorize("ADMIN"), getSupportTicketById);

/**
 * @swagger
 * /api/merchants/support-ticket/{ticketId}:
 *   put:
 *     summary: Update support ticket
 *     description: Allows admin to update support ticket with response and status. Admin only.
 *     tags: [Merchants - Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: ticketId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Support ticket ID
 *         example: "550e8400-e29b-41d4-a716-446655440000"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               response:
 *                 type: string
 *                 example: "We've resolved the issue. Please try again and let us know if you face any problems."
 *                 description: Admin's response to the ticket
 *               status:
 *                 type: string
 *                 enum: [OPEN, IN_PROGRESS, RESOLVED, CLOSED]
 *                 example: "RESOLVED"
 *                 description: Updated status of the ticket
 *     responses:
 *       200:
 *         description: Support ticket updated successfully
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
 *                   example: "Support Ticket updated successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       format: uuid
 *                     merchantId:
 *                       type: string
 *                       format: uuid
 *                     title:
 *                       type: string
 *                     merchantQuery:
 *                       type: string
 *                     adminResponse:
 *                       type: string
 *                       example: "We've resolved the issue."
 *                     status:
 *                       type: string
 *                       example: "RESOLVED"
 *                     createdAt:
 *                       type: string
 *                       format: date-time
 *                     updatedAt:
 *                       type: string
 *                       format: date-time
 *       400:
 *         description: Support ticket couldn't be updated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: Support ticket not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.put("/support-ticket/:ticketId", authenticate, authorize("ADMIN"), validate(updateSupportTicketSchema), updateSupportTicket);

/**
 * @swagger
 * /api/merchants/orders:
 *   get:
 *     summary: Get purchase orders for merchant
 *     description: Retrieves all gift card purchase orders for the authenticated merchant with pagination, search, and sorting
 *     tags: [Merchants - Self Service]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Page number
 *         example: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 10
 *         description: Number of items per page
 *         example: 10
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search by customer name, customer email, or gift card title
 *         example: "John"
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [purchasedAt, redeemedAt, price, customerName, status]
 *           default: purchasedAt
 *         description: Field to sort by
 *         example: "purchasedAt"
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
 *         description: Sort order
 *         example: "desc"
 *     responses:
 *       200:
 *         description: Purchase orders fetched successfully
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
 *                   example: "Purchased orders fetched successfully."
 *                 data:
 *                   type: object
 *                   properties:
 *                     data:
 *                       type: array
 *                       items:
 *                         allOf:
 *                           - $ref: '#/components/schemas/PurchasedGiftCard'
 *                           - type: object
 *                             properties:
 *                               giftCard:
 *                                 type: object
 *                                 properties:
 *                                   id:
 *                                     type: string
 *                                     format: uuid
 *                                   title:
 *                                     type: string
 *                                     example: "Holiday Gift Card"
 *                                   price:
 *                                     type: number
 *                                     format: decimal
 *                                     example: 50.00
 *                     pagination:
 *                       type: object
 *                       properties:
 *                         total:
 *                           type: number
 *                           example: 100
 *                         page:
 *                           type: number
 *                           example: 1
 *                         limit:
 *                           type: number
 *                           example: 10
 *                         totalPages:
 *                           type: number
 *                           example: 10
 *                     filters:
 *                       type: object
 *                       properties:
 *                         search:
 *                           type: string
 *                           nullable: true
 *                           example: "John"
 *                         sortBy:
 *                           type: string
 *                           example: "purchasedAt"
 *                         sortOrder:
 *                           type: string
 *                           example: "desc"
 *       400:
 *         description: Merchant not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get("/orders", authenticate, authorize("MERCHANT"), queryValidation(getPurchaseOrdersQuerySchema), getPurchaseOrders);

/**
 * @swagger
 * /api/merchants/update/profile:
 *   put:
 *     summary: Update merchant user profile
 *     description: Allows authenticated merchant to update their user account information (name, email, phone, avatar, bio)
 *     tags: [Merchants - Self Service]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 example: "John Merchant"
 *               email:
 *                 type: string
 *                 format: email
 *                 example: "merchant@example.com"
 *               phone:
 *                 type: string
 *                 example: "+1234567890"
 *               avatar:
 *                 type: string
 *                 example: "https://example.com/avatar.jpg"
 *               bio:
 *                 type: string
 *                 example: "Experienced business owner"
 *     responses:
 *       200:
 *         description: Profile updated successfully
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
 *                   example: "Profile updated successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       format: uuid
 *                     email:
 *                       type: string
 *                       format: email
 *                     name:
 *                       type: string
 *                     phone:
 *                       type: string
 *                     role:
 *                       type: string
 *                       example: "MERCHANT"
 *                     isActive:
 *                       type: boolean
 *                     avatar:
 *                       type: string
 *                     bio:
 *                       type: string
 *       400:
 *         description: Bad request - No fields to update or update failed
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.put("/update/profile", authenticate, authorize("MERCHANT"), validate(updateAdminProfileSchema), updateProfile);


/**
 * @swagger
 * /api/merchants/dashboard:
 *   get:
 *     summary: Get merchant dashboard statistics
 *     description: Retrieves comprehensive dashboard statistics for the authenticated merchant including sales, gift cards, redemptions, revenue, and customer metrics
 *     tags: [Merchants - Self Service]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Dashboard statistics retrieved successfully
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
 *                   example: "Dashboard data fetched successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     totalSales:
 *                       type: number
 *                       format: decimal
 *                       example: 50000.00
 *                       description: Total amount from all gift card purchases (all time)
 *                     activeGiftCards:
 *                       type: number
 *                       example: 25
 *                       description: Number of active gift cards currently available
 *                     redemptions:
 *                       type: number
 *                       example: 120
 *                       description: Total number of redemptions in the current month
 *                     revenue:
 *                       type: number
 *                       format: decimal
 *                       example: 15000.00
 *                       description: Total revenue from redemptions in the current month
 *                     avgOrderValue:
 *                       type: string
 *                       example: "125.50"
 *                       description: Average redemption amount (all time, formatted to 2 decimal places)
 *                     customersCount:
 *                       type: number
 *                       example: 85
 *                       description: Number of unique customers (by email) who have purchased gift cards
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get("/dashboard", authenticate, authorize("MERCHANT"), getMerchantDashboardStats);

export default router;