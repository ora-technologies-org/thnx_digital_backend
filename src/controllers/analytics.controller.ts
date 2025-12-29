// dashboard.controller.ts
import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { StatusCodes } from '../utils/statusCodes';
import { successResponse } from '../utils/response';

const prisma = new PrismaClient();

type TimeRange = '1d' | '7d' | '30d' | '1y';

interface DashboardQuery {
  timeRange?: TimeRange;
}

// Helper function to get date range based on time range
const getDateRange = (timeRange: TimeRange = '30d') => {
  const now = new Date();
  const startDate = new Date();

  switch (timeRange) {
    case '1d':
      startDate.setDate(now.getDate() - 1);
      break;
    case '7d':
      startDate.setDate(now.getDate() - 7);
      break;
    case '30d':
      startDate.setDate(now.getDate() - 30);
      break;
    case '1y':
      startDate.setFullYear(now.getFullYear() - 1);
      break;
  }

  return { startDate, endDate: now };
};

// Helper function to get previous period date range
const getPreviousPeriodRange = (timeRange: TimeRange = '30d') => {
  const { startDate, endDate } = getDateRange(timeRange);
  const duration = endDate.getTime() - startDate.getTime();
  
  const prevEndDate = new Date(startDate.getTime());
  const prevStartDate = new Date(startDate.getTime() - duration);

  return { startDate: prevStartDate, endDate: prevEndDate };
};

// Helper function to calculate percentage change
const calculatePercentageChange = (current: number, previous: number): number => {
  if (previous === 0) return current > 0 ? 100 : 0;
  return Number(((current - previous) / previous * 100).toFixed(2));
};

export const getDashboardStats = async (req: Request, res: Response) => {
  try {
    const { timeRange = '30d' } = req.query as DashboardQuery;
    const { startDate, endDate } = getDateRange(timeRange);
    const { startDate: prevStartDate, endDate: prevEndDate } = getPreviousPeriodRange(timeRange);

    // 1. OVERVIEW SECTION
    
    // Total Merchants (all time)
    const totalMerchants = await prisma.merchantProfile.count();

    // Total Revenue (filtered by time range)
    const revenueData = await prisma.purchasedGiftCard.aggregate({
      where: {
        purchasedAt: { gte: startDate, lte: endDate },
        paymentStatus: 'COMPLETED'
      },
      _sum: { purchaseAmount: true }
    });
    const totalRevenue = Number(revenueData._sum.purchaseAmount || 0);

    // Previous period revenue for comparison
    const prevRevenueData = await prisma.purchasedGiftCard.aggregate({
      where: {
        purchasedAt: { gte: prevStartDate, lte: prevEndDate },
        paymentStatus: 'COMPLETED'
      },
      _sum: { purchaseAmount: true }
    });
    const prevRevenue = Number(prevRevenueData._sum.purchaseAmount || 0);
    const revenuePercentageChange = calculatePercentageChange(totalRevenue, prevRevenue);

    // Gift Cards Sold (filtered by time range)
    const giftCardsSold = await prisma.purchasedGiftCard.count({
      where: {
        purchasedAt: { gte: startDate, lte: endDate }
      }
    });

    const prevGiftCardsSold = await prisma.purchasedGiftCard.count({
      where: {
        purchasedAt: { gte: prevStartDate, lte: prevEndDate }
      }
    });
    const giftCardsSoldPercentageChange = calculatePercentageChange(giftCardsSold, prevGiftCardsSold);

    // Total Orders (same as gift cards sold in this context)
    const totalOrders = giftCardsSold;
    const ordersPercentageChange = giftCardsSoldPercentageChange;

    // 2. VERIFICATION STATUS
    const verificationStatus = await prisma.merchantProfile.groupBy({
      by: ['profileStatus'],
      _count: true
    });

    const verificationStats = {
      pending: verificationStatus.find(v => v.profileStatus === 'PENDING_VERIFICATION')?._count || 0,
      verified: verificationStatus.find(v => v.profileStatus === 'VERIFIED')?._count || 0,
      rejected: verificationStatus.find(v => v.profileStatus === 'REJECTED')?._count || 0
    };

    // Active Customers (unique customers who purchased in time range)
    const activeCustomers = await prisma.purchasedGiftCard.groupBy({
      by: ['customerEmail'],
      where: {
        purchasedAt: { gte: startDate, lte: endDate }
      }
    });
    const activeCustomersCount = activeCustomers.length;

    const prevActiveCustomers = await prisma.purchasedGiftCard.groupBy({
      by: ['customerEmail'],
      where: {
        purchasedAt: { gte: prevStartDate, lte: prevEndDate }
      }
    });
    const prevActiveCustomersCount = prevActiveCustomers.length;
    const activeCustomersPercentageChange = calculatePercentageChange(
      activeCustomersCount, 
      prevActiveCustomersCount
    );

    // 3. SALES ANALYTICS - Monthly Revenue Trends (All 12 months of current year)
    const currentYear = endDate.getFullYear();
    const yearStart = new Date(currentYear, 0, 1); // January 1st
    const yearEnd = new Date(currentYear, 11, 31, 23, 59, 59); // December 31st

    const monthlyRevenue = await prisma.$queryRaw<Array<{ month: Date; revenue: number }>>`
      SELECT 
        DATE_TRUNC('month', "purchasedAt") as month,
        SUM("purchaseAmount")::float as revenue
      FROM "purchased_gift_cards"
      WHERE "purchasedAt" >= ${yearStart}
        AND "purchasedAt" <= ${yearEnd}
        AND "paymentStatus" = 'COMPLETED'
      GROUP BY DATE_TRUNC('month', "purchasedAt")
      ORDER BY month ASC
    `;

    // Create full 12-month array with all months
    const allMonths = [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
    ];

    const monthlyRevenueMap = new Map(
      monthlyRevenue.map(item => [
        new Date(item.month).getMonth(),
        Number(item.revenue)
      ])
    );

    const monthlyRevenueTrends = allMonths.map((monthName, index) => ({
      month: monthName,
      revenue: monthlyRevenueMap.get(index) || 0
    }));

    // Get current month and previous month revenue for percentage calculation
    const currentMonth = endDate.getMonth();
    const previousMonth = currentMonth === 0 ? 11 : currentMonth - 1;
    
    const currentMonthRevenue = monthlyRevenueMap.get(currentMonth) || 0;
    const previousMonthRevenue = monthlyRevenueMap.get(previousMonth) || 0;
    const monthlyRevenuePercentageChange = calculatePercentageChange(
      currentMonthRevenue,
      previousMonthRevenue
    );

    // 4. MERCHANT GROWTH - New Merchants Over Time (All 12 months)
    const merchantGrowth = await prisma.$queryRaw<Array<{ month: Date; count: bigint }>>`
      SELECT 
        DATE_TRUNC('month', "createdAt") as month,
        COUNT(*)::bigint as count
      FROM "merchant_profiles"
      WHERE "createdAt" >= ${yearStart}
        AND "createdAt" <= ${yearEnd}
      GROUP BY DATE_TRUNC('month', "createdAt")
      ORDER BY month ASC
    `;

    const merchantGrowthMap = new Map(
      merchantGrowth.map(item => [
        new Date(item.month).getMonth(),
        Number(item.count)
      ])
    );

    const merchantGrowthTrends = allMonths.map((monthName, index) => ({
      month: monthName,
      count: merchantGrowthMap.get(index) || 0
    }));

    // Get current month and previous month merchant count for percentage
    const currentMonthMerchants = merchantGrowthMap.get(currentMonth) || 0;
    const previousMonthMerchants = merchantGrowthMap.get(previousMonth) || 0;
    const monthlyMerchantGrowthPercentageChange = calculatePercentageChange(
      currentMonthMerchants,
      previousMonthMerchants
    );

    // New merchants in current period
    const newMerchants = await prisma.merchantProfile.count({
      where: {
        createdAt: { gte: startDate, lte: endDate }
      }
    });

    // New merchants in previous period
    const prevNewMerchants = await prisma.merchantProfile.count({
      where: {
        createdAt: { gte: prevStartDate, lte: prevEndDate }
      }
    });
    const merchantGrowthPercentageChange = calculatePercentageChange(newMerchants, prevNewMerchants);

    // 5. GIFT CARD STATUS - Pie Chart Data
    const giftCardStatusData = await prisma.purchasedGiftCard.groupBy({
      by: ['status'],
      _count: true,
      where: {
        purchasedAt: { gte: startDate, lte: endDate }
      }
    });

    const totalGiftCards = giftCardStatusData.reduce((sum, item) => sum + item._count, 0);
    
    const giftCardStatus = giftCardStatusData.map(item => ({
      status: item.status,
      count: item._count,
      percentage: totalGiftCards > 0 ? Number(((item._count / totalGiftCards) * 100).toFixed(2)) : 0
    }));

    // Ensure all statuses are represented
    const allStatuses = ['ACTIVE', 'FULLY_REDEEMED', 'EXPIRED', 'CANCELLED'];
    const giftCardStatusComplete = allStatuses.map(status => {
      const existing = giftCardStatus.find(s => s.status === status);
      return existing || { status, count: 0, percentage: 0 };
    });

    // Final Response
    const response = {
      timeRange,
      dateRange: {
        start: startDate,
        end: endDate
      },
      overview: {
        totalMerchants,
        totalRevenue: {
          value: totalRevenue,
          percentageChange: revenuePercentageChange
        },
        giftCardsSold: {
          value: giftCardsSold,
          percentageChange: giftCardsSoldPercentageChange
        },
        totalOrders: {
          value: totalOrders,
          percentageChange: ordersPercentageChange
        }
      },
      verificationStatus: {
        ...verificationStats,
        activeCustomers: {
          value: activeCustomersCount,
          percentageChange: activeCustomersPercentageChange
        }
      },
      salesAnalytics: {
        monthlyRevenueTrends,
        currentMonthRevenue,
        previousMonthRevenue,
        percentageChange: monthlyRevenuePercentageChange
      },
      merchantGrowth: {
        trends: merchantGrowthTrends,
        currentMonthMerchants,
        previousMonthMerchants,
        percentageChange: monthlyMerchantGrowthPercentageChange
      },
      giftCardStatus: giftCardStatusComplete
    };

    return res.status(StatusCodes.OK).json(successResponse("Dashboard data fetched successfully.", response));

  } catch (error) {
    console.error('Dashboard stats error:', error);
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Failed to fetch dashboard statistics',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Export route
export default getDashboardStats;