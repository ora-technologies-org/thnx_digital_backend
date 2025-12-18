import { Request, Response } from 'express';
import { ActivityLogFilters } from '../types/activityLog.types';
import { getActivityLogs, getActivityStats, getResourceTimeline } from '../services/activityLog.service';

export const listActivityLogs = async (req: Request, res: Response) => {
  try {
    const filters: ActivityLogFilters = {
      page: req.query.page ? parseInt(req.query.page as string) : 1,
      limit: req.query.limit ? parseInt(req.query.limit as string) : 50,
      category: req.query.category as any,
      severity: req.query.severity as any,
      merchantId: req.query.merchantId as string,
      actorId: req.query.actorId as string,
      resourceType: req.query.resourceType as string,
      resourceId: req.query.resourceId as string,
      startDate: req.query.startDate as string,
      endDate: req.query.endDate as string,
      search: req.query.search as string
    };

    const result = await getActivityLogs(filters);
    res.json(result);
  } catch (error) {
    console.error('Error fetching activity logs:', error);
    res.status(500).json({ error: 'Failed to fetch activity logs' });
  }
};

export const getStats = async (req: Request, res: Response) => {
  try {
    const merchantId = req.query.merchantId as string | undefined;
    const stats = await getActivityStats(merchantId);
    res.json(stats);
  } catch (error) {
    console.error('Error fetching activity stats:', error);
    res.status(500).json({ error: 'Failed to fetch activity stats' });
  }
};

export const getTimeline = async (req: Request, res: Response) => {
  try {
    const { resourceType, resourceId } = req.params;

    if (!resourceType || !resourceId) {
      return res.status(400).json({ error: 'resourceType and resourceId are required' });
    }

    const timeline = await getResourceTimeline(resourceType, resourceId);
    res.json(timeline);
  } catch (error) {
    console.error('Error fetching timeline:', error);
    res.status(500).json({ error: 'Failed to fetch timeline' });
  }
};