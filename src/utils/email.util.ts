import nodemailer from 'nodemailer';

// Configure your email service
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  },
});

export const sendGiftCardEmail = async (
  to: string,
  purchaseData: any,
  qrCodeImage: string
) => {
  try {
    // Convert base64 to buffer
    const base64Data = qrCodeImage.replace(/^data:image\/png;base64,/, '');
    const imageBuffer = Buffer.from(base64Data, 'base64');

    // Safely get merchant business name
    const businessName = 
      purchaseData.giftCard?.merchant?.merchantProfile?.businessName || 
      purchaseData.giftCard?.merchant?.name || 
      'Merchant';

    const mailOptions = {
      from: process.env.EMAIL_USER,
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
              <p style="font-weight: bold; margin-bottom: 10px;">Scan this QR code at ${businessName}:</p>
              <img src="cid:qrcode" alt="QR Code" style="width: 300px; height: 300px; border: 1px solid #ddd; padding: 10px; background: white;" />
            </div>
            
            <div style="background-color: #fff; padding: 15px; border-radius: 5px; margin-top: 15px;">
              <p style="margin: 5px 0;"><strong>QR Code ID:</strong></p>
              <p style="font-family: monospace; font-size: 14px; color: #333; word-break: break-all; margin: 5px 0;">
                ${purchaseData.qrCode}
              </p>
            </div>
          </div>
          
          <div style="margin-top: 20px; padding: 15px; background-color: #fff3cd; border-radius: 5px; border-left: 4px solid #ffc107;">
            <p style="margin: 0; color: #856404; font-size: 14px;">
              <strong>📱 How to use:</strong><br>
              1. Show this QR code to the merchant<br>
              2. They will scan it to see your current balance<br>
              3. You can use any amount up to your balance<br>
              4. The same QR code works until balance reaches ₹0
            </p>
          </div>
          
          <div style="margin-top: 20px; padding: 15px; background-color: #e7f3ff; border-radius: 5px; border-left: 4px solid #2196F3;">
            <p style="margin: 0; color: #0c5460; font-size: 14px;">
              <strong>💡 Tip:</strong> You can check your balance anytime at:<br>
              <a href="${process.env.APP_URL}/verify/${purchaseData.qrCode}" 
                 style="color: #2196F3; text-decoration: none;">
                ${process.env.APP_URL}/verify/${purchaseData.qrCode}
              </a>
            </p>
          </div>
          
          <p style="margin-top: 30px; color: #666; font-size: 12px; text-align: center; border-top: 1px solid #ddd; padding-top: 15px;">
            Keep this email safe. The QR code updates automatically when you use it.<br>
            Questions? Contact ${businessName} at ${purchaseData.giftCard?.merchant?.merchantProfile?.businessPhone || 'N/A'}
          </p>
        </div>
      `,
      attachments: [
        {
          filename: `gift-card-${purchaseData.qrCode}.png`,
          content: imageBuffer,
          cid: 'qrcode',
        },
      ],
    };

    await transporter.sendMail(mailOptions);
    console.log('Gift card email sent successfully to:', to);
  } catch (error) {
    console.error('Email sending error:', error);
    throw error;
  }
};