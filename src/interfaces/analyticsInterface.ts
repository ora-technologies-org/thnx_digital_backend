export interface AnalyticsData {
  totalGiftCardIssued: number;
  totalRevenue: number;
  activeCards: number;
  inActiveCards: number;
  totalPurchases: number;
  totalRedemptions: number;
  averagePurchaseAmount: number;
  redemptionRate: number;
  redemptionAmount: number;
  outstandingBalance: number;
  popularGiftCards: any[];
  revenueByMonth: any[];
  redemptionsByMonth: any[];
  customerMetrics: {
    totalCustomers: number;
    repeatCustomers: number;
    averageCustomerValue: number;
  };
  cardUtilization: {
    fullyRedeemed: number;
    partiallyRedeemed: number;
    unused: number;
    expired: number;
  };
}