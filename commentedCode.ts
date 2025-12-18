// export const getAnalytics = async (req: Request, res: Response, next: NextFunction) => {
//   try {
//     const giftCard = await prisma.giftCard.findMany();
//     const purchases = await prisma.purchasedGiftCard.findMany();
//     const activeGiftCard = await prisma.giftCard.groupBy({
//       by: ["isActive"],
//       _count:{
//         id: true
//       }
//     });
//     const redemptions = await prisma.redemption.findMany()

//     const totalRevenue = purchases.reduce((sum, purchase) => sum + Number(purchase.purchaseAmount), 0)
//     const redemptionAmount = redemptions.reduce((sum, redemption) => sum + Number(redemption.amount), 0);


//     const popularGiftCards = await prisma.giftCard.findMany({
//       include: {
//         _count: {
//           select: {
//             purchases: true,
//           },
//         },
//       },
//       orderBy: {
//         purchases: {
//           _count: "desc",
//         },
//       },
//       take: 5,
//     });

//     const activeCount = {
//       activeCards: 0,
//       inactiveCards: 0
//     };

//     activeGiftCard.forEach((cards) => {
//       if (cards.isActive === true){
//         activeCount.activeCards = cards._count.id
//       }else if (cards.isActive === false){
//         activeCount.inactiveCards = cards._count.id
//       }
//     });
    
//     let averagePurchaseAmount = totalRevenue/purchases.length
//     let redemptionRate = (redemptionAmount/totalRevenue) * 100
//     return res.status(200).json({
//       success: true,
//       message: "Gift card fetched successfully",
//       data: {
//         totalGiftCardIssued: giftCard.length,
//         totalRevenue: totalRevenue,
//         activeCards: activeCount.activeCards,
//         inActiveCards: activeCount.inactiveCards,
//         averagePurchaseAmount: averagePurchaseAmount,
//         redemptionRate: redemptionRate,
//         popularGiftCards: popularGiftCards,
//         giftCard: giftCard,
//         users: purchases
//       }
//     });

//   } catch (error: any) {
//     return res.status(500).json({
//       success: false,
//       message: "Error fetching analytics",
//       error: error.message
//     })
//   }
// }
