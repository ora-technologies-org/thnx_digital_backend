

import { Resend } from 'resend';

// Hardcoding the API Key and Frontend URL for now
const RESEND_API_KEY = 're_iyEKPAa3_F83kdokpirXWGTUGZfEg3k8J';
const FRONTEND_URL = 'http://thnxdigital.com';

const resend = new Resend(RESEND_API_KEY);

console.log('📧 Email util loaded. Resend configured:', !!resend, 'API Key prefix:', RESEND_API_KEY?.substring(0, 10));

// Welcome email for new merchants
export const sendWelcomeEmail = async (
  to: string,
  name: string,
  password: string,
  businessName?: string
) => {
  if (!resend) {
    console.log('Email not configured, skipping welcome email to:', to);
    return;
  }

  try {
    await resend.emails.send({
      from: 'THNX Digital <noreply@thnxdigital.com>',
      to,
      subject: `Welcome to THNX Digital - Your Merchant Account is Ready!`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #4CAF50;">Welcome to THNX Digital! 🎉</h2>
          
          <p>Hi ${name},</p>
          
          <p>Your merchant account for <strong>${"businessName"}</strong> has been created and verified.</p>
          
          <div style="background-color: #f9f9f9; border: 1px solid #ddd; border-radius: 8px; padding: 20px; margin: 20px 0;">
            <h3 style="margin-top: 0;">Your Login Credentials:</h3>
            <p><strong>Email:</strong> ${to}</p>
            <p><strong>Password:</strong> ${password}</p>
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

    console.log('Welcome email sent to:', to);
  } catch (error) {
    console.error('Welcome email error:', error);
  }
};

// Gift card purchase email
export const sendGiftCardEmail = async (
  to: string,
  purchaseData: any,
  qrCodeImage: string
) => {
  if (!resend) {
    console.log('Email not configured, skipping gift card email to:', to);
    return;
  }

  try {
    const base64Data = qrCodeImage.replace(/^data:image\/png;base64,/, '');
    
    const businessName = 
      purchaseData.giftCard?.merchant?.merchantProfile?.businessName || 
      purchaseData.giftCard?.merchant?.name || 
      'Merchant';

    await resend.emails.send({
      from: 'THNX Digital <noreply@thnxdigital.com>',
      to,
      subject: `Your Gift Card - ${purchaseData.giftCard?.title || 'Gift Card'}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #4CAF50;">Your Gift Card is Ready! 🎉</h2>
          
          <div style="border: 2px solid #4CAF50; border-radius: 10px; padding: 20px; background-color: #f9f9f9;">
            <h3 style="margin-top: 0;">${purchaseData.giftCard?.title || 'Gift Card'}</h3>
            <p><strong>Balance:</strong> ₹${purchaseData.currentBalance}</p>
            <p><strong>Purchased:</strong> ${new Date(purchaseData.purchasedAt).toLocaleDateString()}</p>
            <p><strong>Expires:</strong> ${new Date(purchaseData.expiresAt).toLocaleDateString()}</p>
            
            <div style="text-align: center; margin: 20px 0;">
              <p style="font-weight: bold;">Scan this QR code at ${businessName}:</p>
              <img src="cid:qrcode" alt="QR Code" style="width: 250px; height: 250px;" />
            </div>
            
            <p style="font-family: monospace; font-size: 12px; color: #666;">
              QR Code: ${purchaseData.qrCode}
            </p>
          </div>
          
          <p style="margin-top: 20px; color: #666; font-size: 14px;">
            Check your balance: <a href="${FRONTEND_URL}/verify/${purchaseData.qrCode}">${FRONTEND_URL}/verify/${purchaseData.qrCode}</a>
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

    console.log('Gift card email sent to:', to);
  } catch (error) {
    console.error('Gift card email error:', error);
  }
};


export const sendForgotPasswordOTP = async (
  to: string,
  username: string,
  otp: string
) => {
  if (!resend) {
    console.log('Email not configured, skipping forgot password OTP to:', to);
    return;
  }

  try {
    await resend.emails.send({
      from: 'THNX Digital <noreply@thnxdigital.com>',
      to,
      subject: 'Reset Your Password - THNX Digital',
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
              body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
                line-height: 1.6;
                color: #333;
                margin: 0;
                padding: 0;
                background-color: #f4f4f4;
              }
              .container {
                max-width: 600px;
                margin: 40px auto;
                background: white;
                border-radius: 8px;
                overflow: hidden;
                box-shadow: 0 2px 8px rgba(0,0,0,0.1);
              }
              .header {
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                padding: 40px 20px;
                text-align: center;
                color: white;
              }
              .header h1 {
                margin: 0;
                font-size: 28px;
                font-weight: 600;
              }
              .content {
                padding: 40px 30px;
              }
              .greeting {
                font-size: 18px;
                margin-bottom: 20px;
                color: #333;
              }
              .message {
                font-size: 16px;
                color: #666;
                margin-bottom: 30px;
              }
              .otp-container {
                background: #f8f9fa;
                border: 2px dashed #667eea;
                border-radius: 8px;
                padding: 30px;
                text-align: center;
                margin: 30px 0;
              }
              .otp-label {
                font-size: 14px;
                color: #666;
                margin-bottom: 10px;
                text-transform: uppercase;
                letter-spacing: 1px;
              }
              .otp-code {
                font-size: 36px;
                font-weight: bold;
                color: #667eea;
                letter-spacing: 8px;
                font-family: 'Courier New', monospace;
              }
              .expiry-note {
                font-size: 14px;
                color: #999;
                margin-top: 15px;
              }
              .warning {
                background: #fff3cd;
                border-left: 4px solid #ffc107;
                padding: 15px;
                margin: 20px 0;
                font-size: 14px;
                color: #856404;
              }
              .footer {
                background: #f8f9fa;
                padding: 20px 30px;
                text-align: center;
                font-size: 14px;
                color: #666;
              }
              .footer a {
                color: #667eea;
                text-decoration: none;
              }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>🔐 Password Reset Request</h1>
              </div>
              <div class="content">
                <div class="greeting">
                  Hello ${username},
                </div>
                <div class="message">
                  We received a request to reset your password. Use the verification code below to complete the process:
                </div>
                
                <div class="otp-container">
                  <div class="otp-label">Your Verification Code</div>
                  <div class="otp-code">${otp}</div>
                  <div class="expiry-note">⏱️ This code expires in 10 minutes</div>
                </div>

                <div class="warning">
                  <strong>⚠️ Security Notice:</strong> If you didn't request a password reset, please ignore this email or contact our support team immediately.
                </div>

                <div class="message">
                  For your security, never share this code with anyone, including THNX Digital staff.
                </div>
              </div>
              <div class="footer">
                <p>Need help? <a href="${FRONTEND_URL}/support">Contact Support</a></p>
                <p>&copy; ${new Date().getFullYear()} THNX Digital. All rights reserved.</p>
              </div>
            </div>
          </body>
        </html>
      `,
    });

    console.log('Forgot password OTP sent to:', to);
  } catch (error) {
    console.error('Forgot password OTP email error:', error);
    throw error;
  }
};

export const sendPasswordResetSuccessEmail = async (
  to: string,
) => {
  if (!resend) {
    console.log('Email not configured, skipping password reset success email to:', to);
    return;
  }

  try {
    await resend.emails.send({
      from: 'THNX Digital <noreply@thnxdigital.com>',
      to,
      subject: 'Password Reset Successful',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #4CAF50;">Password Reset Successful ✓</h2>
          
          <div style="border: 2px solid #4CAF50; border-radius: 10px; padding: 20px; background-color: #f9f9f9;">
            <p>Hi Admin,</p>  
            
            <p>Your password has been successfully reset.</p>
            
            <p><strong>Reset Date:</strong> ${new Date().toLocaleString()}</p>
            
            <div style="background-color: #fff; border-left: 4px solid #4CAF50; padding: 15px; margin: 20px 0;">
              <p style="margin: 0; color: #333;">
                You can now log in to your account using your new password.
              </p>
            </div>
          </div>
          
          <div style="margin-top: 20px; padding: 15px; background-color: #fff3cd; border-radius: 5px;">
            <p style="margin: 0; color: #856404; font-size: 14px;">
              <strong>⚠️ Security Notice:</strong> If you did not make this change, please contact our support team immediately.
            </p>
          </div>
          
          <p style="margin-top: 20px; color: #666; font-size: 14px;">
            Need help? <a href="${FRONTEND_URL}/support" style="color: #4CAF50;">Contact Support</a>
          </p>
          
          <p style="color: #999; font-size: 12px; margin-top: 30px;">
            This is an automated message, please do not reply to this email.
          </p>
        </div>
      `,
    });

    console.log('Password reset success email sent to:', to);
  } catch (error) {
    console.error('Password reset success email error:', error);
  }
};