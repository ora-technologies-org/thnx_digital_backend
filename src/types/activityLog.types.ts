
import { ActivityCategory, ActivitySeverity } from '@prisma/client';
import { Request } from 'express';

export interface LogActivityParams {
  actorId?: string;
  actorType: 'user' | 'merchant' | 'admin' | 'system';
  action: string;
  category: ActivityCategory;
  description: string;
  resourceType?: string;
  resourceId?: string;
  metadata?: Record<string, any>;
  severity?: ActivitySeverity;
  merchantId?: string;
  req?: Request;
}

export interface ActivityLogFilters {
  page?: number;
  limit?: number;
  category?: ActivityCategory;
  severity?: ActivitySeverity;
  merchantId?: string;
  actorId?: string;
  resourceType?: string;
  resourceId?: string;
  startDate?: string;
  endDate?: string;
  search?: string;
}