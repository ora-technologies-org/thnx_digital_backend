
import { Request, Response } from 'express';
import { notificationService } from '../services/notification.service';
import { RecipientType } from '../types/notification.types';

class NotificationController {
 
  async getNotifications(req: Request, res: Response) {
    try {
      const { userId, role } = req.authUser!;
      const { page = '1', limit = '20', unreadOnly = 'false' } = req.query;

      const recipientType = role === 'ADMIN' ? RecipientType.ADMIN : RecipientType.MERCHANT;

      const result = await notificationService.getNotifications(userId, recipientType, {
        page: parseInt(page as string, 10),
        limit: Math.min(parseInt(limit as string, 10), 50), 
        unreadOnly: unreadOnly === 'true',
      });

      return res.status(200).json({
        success: true,
        data: result.notifications,
        pagination: result.pagination,
      });
    } catch (error: any) {
      console.error('Error fetching notifications:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch notifications',
        error: error.message,
      });
    }
  }


  async getUnreadCount(req: Request, res: Response) {
    try {
      const { userId, role } = req.authUser!;
      const recipientType = role === 'ADMIN' ? RecipientType.ADMIN : RecipientType.MERCHANT;

      const count = await notificationService.getUnreadCount(userId, recipientType);

      return res.status(200).json({
        success: true,
        data: { count },
      });
    } catch (error: any) {
      console.error('Error fetching unread count:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch unread count',
        error: error.message,
      });
    }
  }


  async markAsRead(req: Request, res: Response) {
    try {
      const { userId } = req.authUser!;
      const { id } = req.params;

      const result = await notificationService.markAsRead(id, userId);

      if (result.count === 0) {
        return res.status(404).json({
          success: false,
          message: 'Notification not found',
        });
      }

      return res.status(200).json({
        success: true,
        message: 'Notification marked as read',
      });
    } catch (error: any) {
      console.error('Error marking notification as read:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to mark notification as read',
        error: error.message,
      });
    }
  }

 
  async markAllAsRead(req: Request, res: Response) {
    try {
      const { userId, role } = req.authUser!;
      const recipientType = role === 'ADMIN' ? RecipientType.ADMIN : RecipientType.MERCHANT;

      const result = await notificationService.markAllAsRead(userId, recipientType);

      return res.status(200).json({
        success: true,
        message: `${result.count} notifications marked as read`,
        data: { count: result.count },
      });
    } catch (error: any) {
      console.error('Error marking all notifications as read:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to mark all notifications as read',
        error: error.message,
      });
    }
  }

 
  async deleteNotification(req: Request, res: Response) {
    try {
      const { userId } = req.authUser!;
      const { id } = req.params;

      const result = await notificationService.deleteNotification(id, userId);

      if (result.count === 0) {
        return res.status(404).json({
          success: false,
          message: 'Notification not found',
        });
      }

      return res.status(200).json({
        success: true,
        message: 'Notification deleted',
      });
    } catch (error: any) {
      console.error('Error deleting notification:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to delete notification',
        error: error.message,
      });
    }
  }


  async getPreferences(req: Request, res: Response) {
    try {
      const { userId } = req.authUser!;

      const preferences = await notificationService.getPreferences(userId);

      return res.status(200).json({
        success: true,
        data: preferences,
      });
    } catch (error: any) {
      console.error('Error fetching notification preferences:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch notification preferences',
        error: error.message,
      });
    }
  }

  /**
   * Update notification preferences
   * PATCH /api/notifications/preferences
   */
  async updatePreferences(req: Request, res: Response) {
    try {
      const { userId } = req.authUser!;
      const updates = req.body;

      const preferences = await notificationService.updatePreferences(userId, updates);

      return res.status(200).json({
        success: true,
        message: 'Notification preferences updated',
        data: preferences,
      });
    } catch (error: any) {
      console.error('Error updating notification preferences:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to update notification preferences',
        error: error.message,
      });
    }
  }
}

export const notificationController = new NotificationController();
export default notificationController;