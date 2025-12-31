import { authenticate, authorize } from "../middleware/auth.middleware";
import { createContactUs, getAllContactUs, notifyMerchant } from "../controllers/user.controller";
import Router from "express";
import { queryValidation, validate } from "../middleware/validation.middleware";
import { createContactUsSchema, notifyMerchantSchema } from "../validators/user.validator";
import { getContactUsQuerySchema } from "../validators/query.validators";

const router = Router();

/**
 * @swagger
 * /api/contact-us:
 *   post:
 *     summary: Submit contact us form
 *     description: Allows anyone to submit a contact us inquiry. Sends confirmation email to user and notification to admin.
 *     tags: [Contact]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - email
 *               - phone
 *               - message
 *             properties:
 *               name:
 *                 type: string
 *                 example: "John Doe"
 *               email:
 *                 type: string
 *                 format: email
 *                 example: "john@example.com"
 *               phone:
 *                 type: string
 *                 example: "+1234567890"
 *               message:
 *                 type: string
 *                 example: "I would like to know more about your gift card platform."
 *     responses:
 *       200:
 *         description: Contact us submitted successfully
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
 *                   example: "Contact us submitted successfully."
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       format: uuid
 *                     name:
 *                       type: string
 *                       example: "John Doe"
 *                     email:
 *                       type: string
 *                       format: email
 *                       example: "john@example.com"
 *                     phone:
 *                       type: string
 *                       example: "+1234567890"
 *                     message:
 *                       type: string
 *                       example: "I would like to know more about your gift card platform."
 *                     createdAt:
 *                       type: string
 *                       format: date-time
 *                     updatedAt:
 *                       type: string
 *                       format: date-time
 *       400:
 *         description: Bad request - Validation error or submission failed
 *         content:
 *           application/json:
 *             schema:
 *               oneOf:
 *                 - $ref: '#/components/schemas/ErrorResponse'
 *                 - type: object
 *                   properties:
 *                     success:
 *                       type: boolean
 *                       example: false
 *                     message:
 *                       type: string
 *                       example: "Error sending a mail. Your contact us record has been submitted."
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.post("/contact-us", validate(createContactUsSchema), createContactUs);

/**
 * @swagger
 * /api/contact-us:
 *   get:
 *     summary: Get all contact us submissions
 *     description: Retrieves all contact us form submissions with pagination, search, and sorting. Admin only.
 *     tags: [Contact]
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
 *         description: Search by name, email, phone, or message content
 *         example: "gift card"
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
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
 *         description: Contact us messages fetched successfully
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
 *                   example: "Contact Us messages fetched successfully."
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
 *                           name:
 *                             type: string
 *                             example: "John Doe"
 *                           email:
 *                             type: string
 *                             format: email
 *                             example: "john@example.com"
 *                           phone:
 *                             type: string
 *                             example: "+1234567890"
 *                           message:
 *                             type: string
 *                             example: "I would like to know more about your platform."
 *                           createdAt:
 *                             type: string
 *                             format: date-time
 *                           updatedAt:
 *                             type: string
 *                             format: date-time
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
 *                           example: "gift card"
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
router.get("/contact-us", authenticate, authorize("ADMIN"), queryValidation(getContactUsQuerySchema), getAllContactUs);

/**
 * @swagger
 * /api/notify-merchant:
 *   post:
 *     summary: Notify merchant of purchase interest
 *     description: Allows potential customers to express interest in purchasing from a merchant. Creates a purchase intent record and sends notification email to the merchant.
 *     tags: [Contact]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - email
 *               - merchantId
 *             properties:
 *               name:
 *                 type: string
 *                 example: "Jane Smith"
 *                 description: Customer's name
 *               email:
 *                 type: string
 *                 format: email
 *                 example: "jane@example.com"
 *                 description: Customer's email
 *               merchantId:
 *                 type: string
 *                 format: uuid
 *                 example: "550e8400-e29b-41d4-a716-446655440000"
 *                 description: ID of the merchant profile
 *     responses:
 *       200:
 *         description: Merchant notified successfully
 *         content:
 *           application/json:
 *             schema:
 *               oneOf:
 *                 - type: object
 *                   properties:
 *                     success:
 *                       type: boolean
 *                       example: true
 *                     message:
 *                       type: string
 *                       example: "Successfully notified merchant."
 *                     data:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: string
 *                           format: uuid
 *                         customerName:
 *                           type: string
 *                           example: "Jane Smith"
 *                         customerEmail:
 *                           type: string
 *                           format: email
 *                           example: "jane@example.com"
 *                         merchantId:
 *                           type: string
 *                           format: uuid
 *                         createdAt:
 *                           type: string
 *                           format: date-time
 *                         updatedAt:
 *                           type: string
 *                           format: date-time
 *                 - type: object
 *                   description: Email failed but intent saved
 *                   properties:
 *                     success:
 *                       type: boolean
 *                       example: false
 *                     message:
 *                       type: string
 *                       example: "Error sending email, but your response has been saved."
 *       400:
 *         description: Failed to notify merchant
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
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post("/notify-merchant", validate(notifyMerchantSchema), notifyMerchant);


export default router;