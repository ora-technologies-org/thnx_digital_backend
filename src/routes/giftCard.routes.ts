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
  getCardSetting,
} from '../controllers/giftCard.controller';
import {
  authenticate,
  authorize,
  requireVerification,
  requireCompleteProfile,
} from '../middleware/auth.middleware';
import { validate } from '../middleware/validation.middleware';
import { createGiftCardSchema, createSettingsSchema } from '../validators/giftCard.validator';

const router = express.Router();

// ==================== Public Routes ====================

/**
 * @swagger
 * /api/gift-cards/public/active:
 *   get:
 *     summary: Get all active gift cards
 *     description: Get all active gift cards available for purchase (Public access for customers)
 *     tags: [Gift Cards - Public]
 *     responses:
 *       200:
 *         description: Active gift cards retrieved successfully
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
 *                     giftCards:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/GiftCard'
 *                     count:
 *                       type: integer
 *                       example: 25
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get('/public/active', getActiveGiftCards);

// ==================== PROTECTED MERCHANT ROUTES ====================

/**
 * @swagger
 * /api/gift-cards:
 *   post:
 *     summary: Create a new gift card
 *     description: Create a new gift card (Only verified merchants can create gift cards)
 *     tags: [Gift Cards - Merchant]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateGiftCardRequest'
 *     responses:
 *       201:
 *         description: Gift card created successfully
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
 *                   example: "Gift card created successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     giftCard:
 *                       $ref: '#/components/schemas/GiftCard'
 *       400:
 *         description: Validation error
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
 *                   example: "Validation failed"
 *                 errors:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       field:
 *                         type: string
 *                         example: "price"
 *                       message:
 *                         type: string
 *                         example: "Price must be a positive number"
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         description: Forbidden - Merchant profile not verified or role not authorized
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
 *                   example: "Only verified merchants can create gift cards"
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.post(
  '/',
  authenticate,
  authorize('MERCHANT'),
  requireVerification,
  validate(createGiftCardSchema),
  createGiftCard
);

/**
 * @swagger
 * /api/gift-cards:
 *   get:
 *     summary: Get all merchant's gift cards
 *     description: Get all gift cards for the logged-in merchant (Requires complete merchant profile)
 *     tags: [Gift Cards - Merchant]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Page number for pagination
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 10
 *         description: Number of items per page
 *       - in: query
 *         name: isActive
 *         schema:
 *           type: boolean
 *         description: Filter by active status
 *     responses:
 *       200:
 *         description: Merchant's gift cards retrieved successfully
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
 *                     giftCards:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/GiftCard'
 *                     pagination:
 *                       type: object
 *                       properties:
 *                         page:
 *                           type: integer
 *                           example: 1
 *                         limit:
 *                           type: integer
 *                           example: 10
 *                         total:
 *                           type: integer
 *                           example: 50
 *                         totalPages:
 *                           type: integer
 *                           example: 5
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         description: Forbidden - Merchant profile incomplete
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
 *                   example: "Please complete your merchant profile"
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get(
  '/',
  authenticate,
  authorize('MERCHANT'),
  requireCompleteProfile,
  getMyGiftCards
);

/**
 * @swagger
 * /api/gift-cards/{id}:
 *   get:
 *     summary: Get gift card by ID
 *     description: Get a single gift card by ID (Requires complete merchant profile)
 *     tags: [Gift Cards - Merchant]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Gift card ID
 *         example: "550e8400-e29b-41d4-a716-446655440000"
 *     responses:
 *       200:
 *         description: Gift card retrieved successfully
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
 *                     giftCard:
 *                       $ref: '#/components/schemas/GiftCard'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         description: Forbidden - Merchant profile incomplete or not authorized to view
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
 *                   example: "Please complete your merchant profile"
 *       404:
 *         description: Gift card not found
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
 *                   example: "Gift card not found"
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get(
  '/:id',
  authenticate,
  authorize('MERCHANT'),
  requireCompleteProfile,
  getGiftCardById
);

/**
 * @swagger
 * /api/gift-cards/{id}:
 *   put:
 *     summary: Update gift card
 *     description: Update a gift card (Only verified merchants can update)
 *     tags: [Gift Cards - Merchant]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Gift card ID
 *         example: "550e8400-e29b-41d4-a716-446655440000"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateGiftCardRequest'
 *     responses:
 *       200:
 *         description: Gift card updated successfully
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
 *                   example: "Gift card updated successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     giftCard:
 *                       $ref: '#/components/schemas/GiftCard'
 *       400:
 *         description: Validation error
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
 *                   example: "Validation failed"
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         description: Forbidden - Merchant not verified or not authorized to update
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
 *                   example: "Only verified merchants can update gift cards"
 *       404:
 *         description: Gift card not found
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
 *                   example: "Gift card not found"
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.put(
  '/:id',
  authenticate,
  authorize('MERCHANT'),
  requireVerification,
  updateGiftCard
);

/**
 * @swagger
 * /api/gift-cards/{id}:
 *   delete:
 *     summary: Delete gift card
 *     description: Delete a gift card (Only verified merchants can delete)
 *     tags: [Gift Cards - Merchant]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Gift card ID
 *         example: "550e8400-e29b-41d4-a716-446655440000"
 *     responses:
 *       200:
 *         description: Gift card deleted successfully
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
 *                   example: "Gift card deleted successfully"
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         description: Forbidden - Merchant not verified or not authorized to delete
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
 *                   example: "Only verified merchants can delete gift cards"
 *       404:
 *         description: Gift card not found
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
 *                   example: "Gift card not found"
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.delete(
  '/:id',
  authenticate,
  authorize('MERCHANT'),
  requireVerification,
  deleteGiftCard
);

// ==================== SETTINGS ROUTES ====================

/**
 * @swagger
 * /api/gift-cards/settings:
 *   post:
 *     summary: Create merchant gift card settings
 *     description: Create customization settings for merchant's gift cards (colors, gradients, fonts)
 *     tags: [Settings]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateSettingsRequest'
 *     responses:
 *       201:
 *         description: Settings created successfully
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
 *                   example: "Settings created successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     settings:
 *                       $ref: '#/components/schemas/Settings'
 *       400:
 *         description: Validation error or settings already exist
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
 *                   example: "Invalid color format or settings already exist for this merchant"
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.post("/settings", authenticate, authorize("MERCHANT"), validate(createSettingsSchema), createSettings);

/**
 * @swagger
 * /api/gift-cards/card/settings:
 *   get:
 *     summary: Get merchant gift card settings
 *     description: Retrieve the authenticated merchant's gift card customization settings
 *     tags: [Settings]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Settings retrieved successfully
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
 *                     settings:
 *                       $ref: '#/components/schemas/Settings'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       404:
 *         description: Settings not found
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
 *                   example: "Settings not found for this merchant"
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get("/card/settings", authenticate, authorize("MERCHANT"), getCardSetting);

/**
 * @swagger
 * /api/gift-cards/card/settings:
 *   put:
 *     summary: Update merchant gift card settings
 *     description: Update the authenticated merchant's gift card customization settings
 *     tags: [Settings]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateSettingsRequest'
 *     responses:
 *       200:
 *         description: Settings updated successfully
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
 *                   example: "Settings updated successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     settings:
 *                       $ref: '#/components/schemas/Settings'
 *       400:
 *         description: Validation error
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
 *                   example: "Invalid color format"
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       404:
 *         description: Settings not found
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
 *                   example: "Settings not found for this merchant"
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.put("/card/settings", authenticate, authorize("MERCHANT"), updateSettings);




export default router;