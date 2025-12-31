import Router from "express";
import { authenticate, authorize } from "../middleware/auth.middleware";
import { updateProfile } from "../controllers/admin.controller";
import { getAdminDashboardStats } from "../controllers/analytics.controller";
import { validate } from "../middleware/validation.middleware";
import { updateAdminProfileSchema } from "../validators/admin.validators";

const router = Router();

/**
 * @swagger
 * /api/admin/profile:
 *   put:
 *     summary: Update admin profile
 *     description: Allows authenticated admin to update their profile information
 *     tags: [Admin]
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
 *                 example: "John Admin"
 *               email:
 *                 type: string
 *                 format: email
 *                 example: "admin@example.com"
 *               phone:
 *                 type: string
 *                 example: "+1234567890"
 *               avatar:
 *                 type: string
 *                 example: "https://example.com/avatar.jpg"
 *               bio:
 *                 type: string
 *                 example: "System administrator"
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
 *                       example: "ADMIN"
 *                     isActive:
 *                       type: boolean
 *                     avatar:
 *                       type: string
 *                     bio:
 *                       type: string
 *       400:
 *         description: Bad request - No fields to update or validation error
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
router.put("/profile", authenticate, authorize("ADMIN"), validate(updateAdminProfileSchema), updateProfile);

/**
 * @swagger
 * /api/admin/dashboard:
 *   get:
 *     summary: Get admin dashboard statistics
 *     description: Retrieves comprehensive dashboard statistics including revenue trends, merchant growth, verification status, and gift card analytics with time-based filtering and percentage comparisons
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: timeRange
 *         schema:
 *           type: string
 *           enum: [1d, 7d, 30d, 1y]
 *           default: 30d
 *         description: Time range for filtering dashboard data
 *         example: 30d
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
 *                   example: "Dashboard data fetched successfully."
 *                 data:
 *                   type: object
 *                   properties:
 *                     timeRange:
 *                       type: string
 *                       enum: [1d, 7d, 30d, 1y]
 *                       example: "30d"
 *                     dateRange:
 *                       type: object
 *                       properties:
 *                         start:
 *                           type: string
 *                           format: date-time
 *                           example: "2024-12-01T00:00:00.000Z"
 *                         end:
 *                           type: string
 *                           format: date-time
 *                           example: "2024-12-31T23:59:59.999Z"
 *                     overview:
 *                       type: object
 *                       properties:
 *                         totalMerchants:
 *                           type: number
 *                           example: 45
 *                           description: Total number of merchants (all time)
 *                         totalRevenue:
 *                           type: object
 *                           properties:
 *                             value:
 *                               type: number
 *                               format: decimal
 *                               example: 125000.50
 *                             percentageChange:
 *                               type: number
 *                               example: 15.75
 *                               description: Percentage change compared to previous period
 *                         giftCardsSold:
 *                           type: object
 *                           properties:
 *                             value:
 *                               type: number
 *                               example: 500
 *                             percentageChange:
 *                               type: number
 *                               example: 12.34
 *                         totalOrders:
 *                           type: object
 *                           properties:
 *                             value:
 *                               type: number
 *                               example: 500
 *                             percentageChange:
 *                               type: number
 *                               example: 12.34
 *                     verificationStatus:
 *                       type: object
 *                       properties:
 *                         pending:
 *                           type: number
 *                           example: 5
 *                           description: Merchants pending verification
 *                         verified:
 *                           type: number
 *                           example: 35
 *                           description: Verified merchants
 *                         rejected:
 *                           type: number
 *                           example: 3
 *                           description: Rejected merchants
 *                         activeCustomers:
 *                           type: object
 *                           properties:
 *                             value:
 *                               type: number
 *                               example: 150
 *                               description: Unique customers who made purchases in time range
 *                             percentageChange:
 *                               type: number
 *                               example: 8.5
 *                     salesAnalytics:
 *                       type: object
 *                       properties:
 *                         monthlyRevenueTrends:
 *                           type: array
 *                           description: Revenue for all 12 months of current year
 *                           items:
 *                             type: object
 *                             properties:
 *                               month:
 *                                 type: string
 *                                 example: "Jan"
 *                               revenue:
 *                                 type: number
 *                                 format: decimal
 *                                 example: 10500.00
 *                         currentMonthRevenue:
 *                           type: number
 *                           format: decimal
 *                           example: 15000.00
 *                         previousMonthRevenue:
 *                           type: number
 *                           format: decimal
 *                           example: 12000.00
 *                         percentageChange:
 *                           type: number
 *                           example: 25.00
 *                           description: Month-over-month revenue change percentage
 *                     merchantGrowth:
 *                       type: object
 *                       properties:
 *                         trends:
 *                           type: array
 *                           description: New merchant registrations for all 12 months
 *                           items:
 *                             type: object
 *                             properties:
 *                               month:
 *                                 type: string
 *                                 example: "Jan"
 *                               count:
 *                                 type: number
 *                                 example: 5
 *                         currentMonthMerchants:
 *                           type: number
 *                           example: 8
 *                         previousMonthMerchants:
 *                           type: number
 *                           example: 6
 *                         percentageChange:
 *                           type: number
 *                           example: 33.33
 *                           description: Month-over-month merchant growth percentage
 *                     giftCardStatus:
 *                       type: array
 *                       description: Distribution of gift card statuses with percentages
 *                       items:
 *                         type: object
 *                         properties:
 *                           status:
 *                             type: string
 *                             enum: [ACTIVE, FULLY_REDEEMED, EXPIRED, CANCELLED]
 *                             example: "ACTIVE"
 *                           count:
 *                             type: number
 *                             example: 300
 *                           percentage:
 *                             type: number
 *                             format: decimal
 *                             example: 60.00
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get("/dashboard", authenticate, authorize("ADMIN"), getAdminDashboardStats);

export default router;