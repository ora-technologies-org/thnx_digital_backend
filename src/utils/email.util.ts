// import { Resend } from 'resend';



// // const resend = process.env.RESEND_API_KEY 
// //   ? new Resend(process.env.RESEND_API_KEY) 
// //   : null;

//   const resend =  "re_iyEKPAa3_F83kdokpirXWGTUGZfEg3k8J"
//     ? new Resend("re_iyEKPAa3_F83kdokpirXWGTUGZfEg3k8J") 
//     : null;
  


// console.log('📧 Email util loaded. Resend configured:', !!resend, 'API Key prefix:', process.env.RESEND_API_KEY?.substring(0, 10));

// // Welcome email for new merchants
// export const sendWelcomeEmail = async (
//   to: string,
//   name: string,
//   password: string,
//   businessName: string
// ) => {
//   if (!resend) {
//     console.log('Email not configured, skipping welcome email to:', to);
//     return;
//   }


//   try {
//     const appUrl = process.env.FRONTEND_URL || 'https://thnxdigital.com';

//     await resend.emails.send({
//       from: 'THNX Digital <noreply@thnxdigital.com>',
//       to,
//       subject: `Welcome to THNX Digital - Your Merchant Account is Ready!`,
//       html: `
//         <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
//           <h2 style="color: #4CAF50;">Welcome to THNX Digital! 🎉</h2>
          
//           <p>Hi ${name},</p>
          
//           <p>Your merchant account for <strong>${businessName}</strong> has been created and verified.</p>
          
//           <div style="background-color: #f9f9f9; border: 1px solid #ddd; border-radius: 8px; padding: 20px; margin: 20px 0;">
//             <h3 style="margin-top: 0;">Your Login Credentials:</h3>
//             <p><strong>Email:</strong> ${to}</p>
//             <p><strong>Password:</strong> ${password}</p>
//             <p style="color: #e74c3c; font-size: 14px;">⚠️ Please change your password after first login!</p>
//           </div>
          
//           <div style="text-align: center; margin: 30px 0;">
//             <a href="${appUrl}/login" 
//                style="background-color: #4CAF50; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold;">
//               Login to Dashboard
//             </a>
//           </div>
          
//           <div style="background-color: #e7f3ff; border-radius: 5px; padding: 15px; margin-top: 20px;">
//             <p style="margin: 0; font-size: 14px;">
//               <strong>What you can do:</strong><br>
//               ✅ Create gift cards for your business<br>
//               ✅ Track purchases and redemptions<br>
//               ✅ Scan QR codes to redeem gift cards
//             </p>
//           </div>
          
//           <p style="margin-top: 30px; color: #666; font-size: 12px; border-top: 1px solid #ddd; padding-top: 15px;">
//             If you have any questions, contact us at support@thnxdigital.com
//           </p>
//         </div>
//       `,
//     });

//     console.log('Welcome email sent to:', to);
//   } catch (error) {
//     console.error('Welcome email error:', error);
//   }
// };

// // Gift card purchase email
// export const sendGiftCardEmail = async (
//   to: string,
//   purchaseData: any,
//   qrCodeImage: string
// ) => {
//   if (!resend) {
//     console.log('Email not configured, skipping gift card email to:', to);
//     return;
//   }

//   try {
//     const base64Data = qrCodeImage.replace(/^data:image\/png;base64,/, '');
    
//     const businessName = 
//       purchaseData.giftCard?.merchant?.merchantProfile?.businessName || 
//       purchaseData.giftCard?.merchant?.name || 
//       'Merchant';

//     const appUrl = process.env.FRONTEND_URL || 'https://thnxdigital.com';

//     await resend.emails.send({
//       from: 'THNX Digital <noreply@thnxdigital.com>',
//       to,
//       subject: `Your Gift Card - ${purchaseData.giftCard?.title || 'Gift Card'}`,
//       html: `
//         <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
//           <h2 style="color: #4CAF50;">Your Gift Card is Ready! 🎉</h2>
          
//           <div style="border: 2px solid #4CAF50; border-radius: 10px; padding: 20px; background-color: #f9f9f9;">
//             <h3 style="margin-top: 0;">${purchaseData.giftCard?.title || 'Gift Card'}</h3>
//             <p><strong>Balance:</strong> ₹${purchaseData.currentBalance}</p>
//             <p><strong>Purchased:</strong> ${new Date(purchaseData.purchasedAt).toLocaleDateString()}</p>
//             <p><strong>Expires:</strong> ${new Date(purchaseData.expiresAt).toLocaleDateString()}</p>
            
//             <div style="text-align: center; margin: 20px 0;">
//               <p style="font-weight: bold;">Scan this QR code at ${businessName}:</p>
//               <img src="cid:qrcode" alt="QR Code" style="width: 250px; height: 250px;" />
//             </div>
            
//             <p style="font-family: monospace; font-size: 12px; color: #666;">
//               QR Code: ${purchaseData.qrCode}
//             </p>
//           </div>
          
//           <p style="margin-top: 20px; color: #666; font-size: 14px;">
//             Check your balance: <a href="${appUrl}/verify/${purchaseData.qrCode}">${appUrl}/verify/${purchaseData.qrCode}</a>
//           </p>
//         </div>
//       `,
//       attachments: [
//         {
//           filename: 'gift-card-qr.png',
//           content: base64Data,
//           contentId: 'qrcode',
//         },
//       ],
//     });

//     console.log('Gift card email sent to:', to);
//   } catch (error) {
//     console.error('Gift card email error:', error);
//   }
// };




import { Resend } from 'resend';

// Hardcoding the API Key and Frontend URL for now
const RESEND_API_KEY = 're_iyEKPAa3_F83kdokpirXWGTUGZfEg3k8J';
const FRONTEND_URL = 'https://thnxdigital.com';

const resend = new Resend(RESEND_API_KEY);

console.log('📧 Email util loaded. Resend configured:', !!resend, 'API Key prefix:', RESEND_API_KEY?.substring(0, 10));

// Welcome email for new merchants
export const sendWelcomeEmail = async (
  to: string,
  name: string,
  password: string,
  businessName: string
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
          
          <p>Your merchant account for <strong>${businessName}</strong> has been created and verified.</p>
          
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
