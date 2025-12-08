import QRCode from 'qrcode';
import crypto from 'crypto';

/**
 * Generate a unique QR code string with Thnx-Digital prefix
 */
export const generateQRCodeString = (): string => {
  const timestamp = Date.now().toString(36).toUpperCase();
  const randomStr = crypto.randomBytes(8).toString('hex').toUpperCase();
  return `THNX-DIGITAL-${timestamp}-${randomStr}`;
};

/**
 * Generate QR code image as Data URL
 * IMPORTANT: Only encode the QR code ID, not all the data!
 */
export const generateQRCodeImage = async (qrCodeId: string): Promise<string> => {
  try {
    // Create a verification URL that includes the QR code
    const verificationUrl = `${process.env.APP_URL || 'https://thnxdigital.com'}/verify/${qrCodeId}`;
    
    const qrCodeDataURL = await QRCode.toDataURL(verificationUrl, {
      width: 400,
      margin: 2,
      errorCorrectionLevel: 'H', // High error correction
      color: {
        dark: '#000000',
        light: '#FFFFFF',
      },
    });
    return qrCodeDataURL;
  } catch (error) {
    console.error('QR Code generation error:', error);
    throw new Error('Failed to generate QR code');
  }
};

/**
 * Generate QR code with just the ID (for simple scanning)
 */
export const generateSimpleQRCode = async (qrCodeId: string): Promise<string> => {
  try {
    // Just encode the QR code ID itself
    const qrCodeDataURL = await QRCode.toDataURL(qrCodeId, {
      width: 400,
      margin: 2,
      errorCorrectionLevel: 'H',
      color: {
        dark: '#000000',
        light: '#FFFFFF',
      },
    });
    return qrCodeDataURL;
  } catch (error) {
    console.error('QR Code generation error:', error);
    throw new Error('Failed to generate QR code');
  }
};

/**
 * Create display data for email/response (NOT for QR encoding)
 * This is just for showing info to the user, not encoding in QR
 */
export const createDisplayData = (purchasedCard: any) => {
  return {
    qrCode: purchasedCard.qrCode,
    customerName: purchasedCard.customerName,
    originalAmount: purchasedCard.purchaseAmount.toString(),
    currentBalance: purchasedCard.currentBalance.toString(),
    giftCardTitle: purchasedCard.giftCard.title,
    merchantName: purchasedCard.giftCard.merchant.merchantProfile?.businessName || 
                  purchasedCard.giftCard.merchant.name,
    purchasedAt: purchasedCard.purchasedAt.toISOString(),
    expiresAt: purchasedCard.expiresAt.toISOString(),
  };
};