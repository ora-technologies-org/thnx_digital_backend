import { Queue, Worker, Job } from 'bullmq';
import { Resend } from 'resend';
import redisConfig from '../config/redis.config';

const RESEND_API_KEY = process.env.RESEND_API_KEY || 're_iyEKPAa3_F83kdokpirXWGTUGZfEg3k8J';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://thnxdigital.com';

const resend = new Resend(RESEND_API_KEY);


export type EmailJobType = 
  | 'welcome_email'
  | 'gift_card_email'
  | 'password_reset_email'
  | 'merchant_approved_email'
  | 'merchant_rejected_email'
  | 'generic_email';

export interface BaseEmailJobData {
  type: EmailJobType;
  to: string;
}

export interface WelcomeEmailData extends BaseEmailJobData {
  type: 'welcome_email';
  name: string;
  password: string;
  businessName: string;
}

export interface GiftCardEmailData extends BaseEmailJobData {
  type: 'gift_card_email';
  purchaseData: {
    qrCode: string;
    currentBalance: string;
    purchasedAt: string;
    expiresAt: string;
    giftCard: {
      title: string;
      merchant: {
        name?: string;
        merchantProfile?: {
          businessName?: string;
        } | null;
      };
    };
  };
  qrCodeImage: string; // Base64 image
}

export interface PasswordResetEmailData extends BaseEmailJobData {
  type: 'password_reset_email';
  name: string;
  resetLink: string;
}

export interface MerchantApprovedEmailData extends BaseEmailJobData {
  type: 'merchant_approved_email';
  name: string;
  businessName: string;
}

export interface MerchantRejectedEmailData extends BaseEmailJobData {
  type: 'merchant_rejected_email';
  name: string;
  businessName: string;
  rejectionReason: string;
}

export interface GenericEmailData extends BaseEmailJobData {
  type: 'generic_email';
  subject: string;
  html: string;
}

export type EmailJobData = 
  | WelcomeEmailData
  | GiftCardEmailData
  | PasswordResetEmailData
  | MerchantApprovedEmailData
  | MerchantRejectedEmailData
  | GenericEmailData;

// ============ EMAIL QUEUE ============

export const emailQueue = new Queue<EmailJobData>('emails', {
  connection: redisConfig,
  defaultJobOptions: {
    removeOnComplete: 100,
    removeOnFail: 500,
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
  },
});


export const emailWorker = new Worker<EmailJobData>(
  'emails',
  async (job: Job<EmailJobData>) => {
    const { type, to } = job.data;
    
    console.log(`📧 Processing email job: ${type} to ${to}`);

    switch (type) {
      case 'welcome_email': {
        const data = job.data as WelcomeEmailData;
        await resend.emails.send({
          from: 'THNX Digital <noreply@thnxdigital.com>',
          to,
          subject: `Welcome to THNX Digital - Your Merchant Account is Ready!`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
              <h2 style="color: #4CAF50;">Welcome to THNX Digital! 🎉</h2>
              
              <p>Hi ${data.name},</p>
              
              <p>Your merchant account for <strong>${data.businessName}</strong> has been created and verified.</p>
              
              <div style="background-color: #f9f9f9; border: 1px solid #ddd; border-radius: 8px; padding: 20px; margin: 20px 0;">
                <h3 style="margin-top: 0;">Your Login Credentials:</h3>
                <p><strong>Email:</strong> ${to}</p>
                <p><strong>Password:</strong> ${data.password}</p>
                <p style="color: #e74c3c; font-size: 14px;">⚠️ Please change your password after first login!</p>
              </div>
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="${FRONTEND_URL}/merchant/dashboard" 
                   style="background-color: #4CAF50; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold;">
                  Login to Dashboard
                </a>
              </div>
              
              <div style="background-color: #e7f3ff; border-radius: 5px; padding: 15px; margin-top: 20px;">
                <p style="margin: 0; font-size: 14px;">
                  <strong>What you can do:</strong><br>
                  ✅ Create gift cards for your business<br>
                  ✅ Track purchases and redemptions<br>
                  ✅ Scan QR codes to redeem gift cards
                </p>
              </div>
              
              <p style="margin-top: 30px; color: #666; font-size: 12px; border-top: 1px solid #ddd; padding-top: 15px;">
                If you have any questions, contact us at support@thnxdigital.com
              </p>
            </div>
          `,
        });
        break;
      }

      case 'gift_card_email': {
        const data = job.data as GiftCardEmailData;
        const base64Data = data.qrCodeImage.replace(/^data:image\/png;base64,/, '');
        
        const businessName = 
          data.purchaseData.giftCard?.merchant?.merchantProfile?.businessName || 
          data.purchaseData.giftCard?.merchant?.name || 
          'Merchant';

        await resend.emails.send({
          from: 'THNX Digital <noreply@thnxdigital.com>',
          to,
          subject: `Your Gift Card - ${data.purchaseData.giftCard?.title || 'Gift Card'}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
              <h2 style="color: #4CAF50;">Your Gift Card is Ready! 🎉</h2>
              
              <div style="border: 2px solid #4CAF50; border-radius: 10px; padding: 20px; background-color: #f9f9f9;">
                <h3 style="margin-top: 0;">${data.purchaseData.giftCard?.title || 'Gift Card'}</h3>
                <p><strong>Balance:</strong> ₹${data.purchaseData.currentBalance}</p>
                <p><strong>Purchased:</strong> ${new Date(data.purchaseData.purchasedAt).toLocaleDateString()}</p>
                <p><strong>Expires:</strong> ${new Date(data.purchaseData.expiresAt).toLocaleDateString()}</p>
                
                <div style="text-align: center; margin: 20px 0;">
                  <p style="font-weight: bold;">Scan this QR code at ${businessName}:</p>
                  <img src="cid:qrcode" alt="QR Code" style="width: 250px; height: 250px;" />
                </div>
                
                <p style="font-family: monospace; font-size: 12px; color: #666;">
                  QR Code: ${data.purchaseData.qrCode}
                </p>
              </div>
              
              <p style="margin-top: 20px; color: #666; font-size: 14px;">
                Check your balance: <a href="${FRONTEND_URL}/verify/${data.purchaseData.qrCode}">${FRONTEND_URL}/verify/${data.purchaseData.qrCode}</a>
              </p>
            </div>
          `,
          attachments: [
            {
              filename: 'gift-card-qr.png',
              content: base64Data,
              contentId: 'qrcode',
            },
          ],
        });
        break;
      }

      case 'password_reset_email': {
        const data = job.data as PasswordResetEmailData;
        await resend.emails.send({
          from: 'THNX Digital <noreply@thnxdigital.com>',
          to,
          subject: 'Reset Your Password - THNX Digital',
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
              <h2 style="color: #4CAF50;">Password Reset Request</h2>
              
              <p>Hi ${data.name},</p>
              
              <p>We received a request to reset your password. Click the button below to create a new password:</p>
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="${data.resetLink}" 
                   style="background-color: #4CAF50; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold;">
                  Reset Password
                </a>
              </div>
              
              <p style="color: #888; font-size: 14px;">This link will expire in 1 hour.</p>
              <p style="color: #888; font-size: 14px;">If you didn't request this, please ignore this email.</p>
              
              <p style="margin-top: 30px; color: #666; font-size: 12px; border-top: 1px solid #ddd; padding-top: 15px;">
                If you have any questions, contact us at support@thnxdigital.com
              </p>
            </div>
          `,
        });
        break;
      }

      case 'merchant_approved_email': {
        const data = job.data as MerchantApprovedEmailData;
        await resend.emails.send({
          from: 'THNX Digital <noreply@thnxdigital.com>',
          to,
          subject: `Congratulations! ${data.businessName} is now verified ✅`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
              <h2 style="color: #4CAF50;">Your Account is Verified! 🎉</h2>
              
              <p>Hi ${data.name},</p>
              
              <p>Great news! Your merchant account for <strong>${data.businessName}</strong> has been verified and approved.</p>
              
              <div style="background-color: #e7f3ff; border-radius: 5px; padding: 15px; margin: 20px 0;">
                <p style="margin: 0; font-size: 14px;">
                  <strong>You can now:</strong><br>
                  ✅ Create and manage gift cards<br>
                  ✅ Accept gift card payments<br>
                  ✅ Track redemptions and analytics
                </p>
              </div>
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="${FRONTEND_URL}/merchant/dashboard" 
                   style="background-color: #4CAF50; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold;">
                  Go to Dashboard
                </a>
              </div>
              
              <p style="margin-top: 30px; color: #666; font-size: 12px; border-top: 1px solid #ddd; padding-top: 15px;">
                If you have any questions, contact us at support@thnxdigital.com
              </p>
            </div>
          `,
        });
        break;
      }

      case 'merchant_rejected_email': {
        const data = job.data as MerchantRejectedEmailData;
        await resend.emails.send({
          from: 'THNX Digital <noreply@thnxdigital.com>',
          to,
          subject: `Action Required: ${data.businessName} verification update`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
              <h2 style="color: #f39c12;">Account Verification Update</h2>
              
              <p>Hi ${data.name},</p>
              
              <p>We've reviewed your merchant application for <strong>${data.businessName}</strong>.</p>
              
              <div style="background-color: #fff3cd; border: 1px solid #ffc107; border-radius: 8px; padding: 15px; margin: 20px 0;">
                <p style="margin: 0 0 10px 0;"><strong>Status:</strong> Additional information required</p>
                <p style="margin: 0;"><strong>Reason:</strong> ${data.rejectionReason}</p>
              </div>
              
              <p>Please update your profile with the required information and resubmit for verification.</p>
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="${FRONTEND_URL}/merchant/profile" 
                   style="background-color: #f39c12; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold;">
                  Update Profile
                </a>
              </div>
              
              <p style="margin-top: 30px; color: #666; font-size: 12px; border-top: 1px solid #ddd; padding-top: 15px;">
                If you have any questions, contact us at support@thnxdigital.com
              </p>
            </div>
          `,
        });
        break;
      }

      case 'generic_email': {
        const data = job.data as GenericEmailData;
        await resend.emails.send({
          from: 'THNX Digital <noreply@thnxdigital.com>',
          to,
          subject: data.subject,
          html: data.html,
        });
        break;
      }

      default:
        throw new Error(`Unknown email type: ${type}`);
    }

    console.log(`✅ Email sent: ${type} to ${to}`);
    return { success: true, to, type };
  },
  {
    connection: redisConfig,
    concurrency: 5,
  }
);



emailWorker.on('completed', (job) => {
  console.log(`📧 Email job ${job.id} completed: ${job.data.type} to ${job.data.to}`);
});

emailWorker.on('failed', (job, error) => {
  console.error(`❌ Email job ${job?.id} failed:`, error.message);
});

emailWorker.on('error', (error) => {
  console.error('❌ Email worker error:', error);
});


export const closeEmailQueue = async () => {
  await emailWorker.close();
  await emailQueue.close();
  console.log('📧 Email queue closed');
};