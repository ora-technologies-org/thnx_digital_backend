
export enum NotificationType {
  MERCHANT_REGISTERED = 'MERCHANT_REGISTERED',
  PROFILE_SUBMITTED_FOR_VERIFICATION = 'PROFILE_SUBMITTED_FOR_VERIFICATION',
  PURCHASE_MADE = 'PURCHASE_MADE',
  REDEMPTION_MADE = 'REDEMPTION_MADE',

  PROFILE_VERIFIED = 'PROFILE_VERIFIED',
  PROFILE_REJECTED = 'PROFILE_REJECTED',
  GIFT_CARD_PURCHASED = 'GIFT_CARD_PURCHASED',
  GIFT_CARD_REDEEMED = 'GIFT_CARD_REDEEMED',
}

export enum RecipientType {
  ADMIN = 'ADMIN',
  MERCHANT = 'MERCHANT',
}

export interface CreateNotificationPayload {
  recipientId: string;
  recipientType: RecipientType;
  type: NotificationType;
  title: string;
  message: string;
  resourceType?: string;
  resourceId?: string;
  actorId?: string;
  actorName?: string;
}

export interface NotificationPreferenceUpdate {
  merchantRegistered?: boolean;
  profileSubmittedForVerification?: boolean;
  purchaseMade?: boolean;
  redemptionMade?: boolean;
  profileVerified?: boolean;
  profileRejected?: boolean;
  giftCardPurchased?: boolean;
  giftCardRedeemed?: boolean;
}

export const notificationTypeToPreferenceField: Record<NotificationType, keyof NotificationPreferenceUpdate> = {
  [NotificationType.MERCHANT_REGISTERED]: 'merchantRegistered',
  [NotificationType.PROFILE_SUBMITTED_FOR_VERIFICATION]: 'profileSubmittedForVerification',
  [NotificationType.PURCHASE_MADE]: 'purchaseMade',
  [NotificationType.REDEMPTION_MADE]: 'redemptionMade',
  [NotificationType.PROFILE_VERIFIED]: 'profileVerified',
  [NotificationType.PROFILE_REJECTED]: 'profileRejected',
  [NotificationType.GIFT_CARD_PURCHASED]: 'giftCardPurchased',
  [NotificationType.GIFT_CARD_REDEEMED]: 'giftCardRedeemed',
};

export const notificationTemplates: Record<NotificationType, { title: string; message: (data: any) => string }> = {
  [NotificationType.MERCHANT_REGISTERED]: {
    title: 'New Merchant Registered',
    message: (data) => `${data.merchantName || 'A new merchant'} has registered on the platform.`,
  },
  [NotificationType.PROFILE_SUBMITTED_FOR_VERIFICATION]: {
    title: 'Profile Submitted for Verification',
    message: (data) => `${data.merchantName || 'A merchant'} has submitted their profile for verification.`,
  },
  [NotificationType.PURCHASE_MADE]: {
    title: 'New Purchase',
    message: (data) => `A gift card "${data.giftCardTitle || 'Unknown'}" was purchased for ${data.amount || 'N/A'}.`,
  },
  [NotificationType.REDEMPTION_MADE]: {
    title: 'New Redemption',
    message: (data) => `A redemption of ${data.amount || 'N/A'} was made on a gift card.`,
  },
  [NotificationType.PROFILE_VERIFIED]: {
    title: 'Profile Verified',
    message: () => 'Congratulations! Your merchant profile has been verified. You can now create gift cards.',
  },
  [NotificationType.PROFILE_REJECTED]: {
    title: 'Profile Rejected',
    message: (data) => `Your merchant profile was rejected. Reason: ${data.reason || 'Not specified'}. Please update and resubmit.`,
  },
  [NotificationType.GIFT_CARD_PURCHASED]: {
    title: 'Gift Card Purchased',
    message: (data) => `Your gift card "${data.giftCardTitle || 'Unknown'}" was purchased by ${data.customerName || 'a customer'}.`,
  },
  [NotificationType.GIFT_CARD_REDEEMED]: {
    title: 'Gift Card Redeemed',
    message: (data) => `${data.amount || 'An amount'} was redeemed from your gift card "${data.giftCardTitle || 'Unknown'}".`,
  },
};