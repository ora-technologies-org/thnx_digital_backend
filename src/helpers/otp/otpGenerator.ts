import crypto from "crypto"

export const otpGenerator = (length: number) =>{ 
    const otp = crypto.randomBytes(length).toString("hex").toUpperCase();
    const otpExpiry = new Date(Date.now() + 7 * 60 *1000);
    return {otp, otpExpiry}
}

