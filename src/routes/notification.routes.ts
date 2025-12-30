
import { Router } from 'express';
import { notificationController } from '../controllers/notification.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { validateBody, validateQuery, validateParams } from '../middleware/validate.middleware';
import {
  updatePreferencesSchema,
  getNotificationsQuerySchema,
  notificationIdParamSchema,
} from '../validators/notification.validator';

const router = Router();

router.use(authenticate);

router.use(authorize('ADMIN', 'MERCHANT'));

/**
 * @route   GET /api/notifications
 * @desc    Get notifications for authenticated user
 * @access  Admin, Merchant
 * @query   page, limit, unreadOnly
 */
router.get(
  '/',
  validateQuery(getNotificationsQuerySchema),
  notificationController.getNotifications
);

/**
 * @route   GET /api/notifications/unread-count
 * @desc    Get unread notification count
 * @access  Admin, Merchant
 */
router.get('/unread-count', notificationController.getUnreadCount);

/**
 * @route   GET /api/notifications/preferences
 * @desc    Get notification preferences
 * @access  Admin, Merchant
 */
router.get('/preferences', notificationController.getPreferences);

/**
 * @route   PATCH /api/notifications/preferences
 * @desc    Update notification preferences
 * @access  Admin, Merchant
 */
router.patch(
  '/preferences',
  validateBody(updatePreferencesSchema),
  notificationController.updatePreferences
);

/**
 * @route   PATCH /api/notifications/read-all
 * @desc    Mark all notifications as read
 * @access  Admin, Merchant
 */
router.patch('/read-all', notificationController.markAllAsRead);

/**
 * @route   PATCH /api/notifications/:id/read
 * @desc    Mark a single notification as read
 * @access  Admin, Merchant
 */
router.patch(
  '/:id/read',
  validateParams(notificationIdParamSchema),
  notificationController.markAsRead
);

/**
 * @route   DELETE /api/notifications/:id
 * @desc    Delete a notification
 * @access  Admin, Merchant
 */
router.delete(
  '/:id',
  validateParams(notificationIdParamSchema),
  notificationController.deleteNotification
);

export default router;