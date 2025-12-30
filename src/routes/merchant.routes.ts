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
import { validate } from "../middleware/validation.middleware";
import { adminCreateMerchantSchema } from "../validators/auth.validator";
import { merchantVerifySchema } from "../validators/user.validator";

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
router.get("/", authenticate, authorize("ADMIN"), getAllMerchants);

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
router.get("/pending", authenticate, authorize("ADMIN"), getPendingMerchants);

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

router.put("/", authenticate, authorize("MERCHANT"), uploadMerchantDocs, updateMerchantData);
router.put("/:merchantId", authenticate, authorize("ADMIN"), uploadMerchantDocs, adminUpdateMerchant);


// router.get("/:merchantId", authenticate, authorize("ADMIN"), getMerchantById);

router.get("/cards/:merchantId", authenticate, authorize("ADMIN"), getGiftCardByMerchant);
router.get("/all/verified", authenticate, authorize("ADMIN"), getVerifiedMerchants);
router.get("/analytics/business", authenticate, authorize("ADMIN"), getOverallAnalytics);
router.get("/analytics/report", authenticate, authorize("ADMIN"), generateAnalyticsPDF);
router.post("/support-ticket", authenticate, authorize("MERCHANT"), createSupportTicket);


router.get("/support-ticket", authenticate, authorize("ADMIN"), getAllSupportTickets);
router.get("/support-ticket/:ticketId", authenticate, authorize("ADMIN"), getSupportTicketById);
router.put("/support-ticket/:ticketId", authenticate, authorize("ADMIN"), updateSupportTicket);

router.get("/orders", authenticate, authorize("MERCHANT"), getPurchaseOrders);

router.put("/update/profile", authenticate, authorize("MERCHANT"), updateProfile)
export default router;