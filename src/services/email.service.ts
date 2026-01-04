import { emailQueue } from '../queues/email.queue';



export const EmailService = {
  sendWelcomeEmail: (
    to: string,
    name: string,
    password?: string,
  ): void => {
    emailQueue.add('welcome', {
      type: 'welcome_email',
      to,
      name,
      password,
    }).catch((error) => {
      console.error('Failed to queue welcome email:', error);
    });
  },

  sendGiftCardEmail: (
    to: string,
    purchaseData: any,
    qrCodeImage: string
  ): void => {
    emailQueue.add('gift_card', {
      type: 'gift_card_email',
      to,
      purchaseData: {
        qrCode: purchaseData.qrCode,
        currentBalance: purchaseData.currentBalance.toString(),
        purchasedAt: purchaseData.purchasedAt.toISOString(),
        expiresAt: purchaseData.expiresAt.toISOString(),
        giftCard: {
          title: purchaseData.giftCard.title,
          merchant: {
            name: purchaseData.giftCard.merchant?.name,
            merchantProfile: purchaseData.giftCard.merchant?.merchantProfile,
          },
        },
      },
      qrCodeImage,
    }).catch((error) => {
      console.error('Failed to queue gift card email:', error);
    });
  },

  sendPasswordResetEmail: (
    to: string,
    name: string,
    resetLink: string
  ): void => {
    emailQueue.add('password_reset', {
      type: 'password_reset_email',
      to,
      name,
      resetLink,
    }).catch((error) => {
      console.error('Failed to queue password reset email:', error);
    });
  },

  sendMerchantApprovedEmail: (
    to: string,
    name: string,
    businessName: string
  ): void => {
    emailQueue.add('merchant_approved', {
      type: 'merchant_approved_email',
      to,
      name,
      businessName,
    }).catch((error) => {
      console.error('Failed to queue merchant approved email:', error);
    });
  },

 
  sendMerchantRejectedEmail: (
    to: string,
    name: string,
    businessName: string,
    rejectionReason: string
  ): void => {
    emailQueue.add('merchant_rejected', {
      type: 'merchant_rejected_email',
      to,
      name,
      businessName,
      rejectionReason,
    }).catch((error) => {
      console.error('Failed to queue merchant rejected email:', error);
    });
  },


  sendGenericEmail: (
    to: string,
    subject: string,
    html: string
  ): void => {
    emailQueue.add('generic', {
      type: 'generic_email',
      to,
      subject,
      html,
    }).catch((error) => {
      console.error('Failed to queue generic email:', error);
    });
  },
};