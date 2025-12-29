import { NextFunction, Request, Response } from "express";
import { createContactUsSchema } from "../validators/user.validator";
import prisma from "../utils/prisma.util";
import { sendContactUsAdminNotification, sendContactUsConfirmation, sendMerchantNotificationEmail } from "../utils/email.util";
import { mode } from "crypto-js";
import { StatusCodes } from "../utils/statusCodes";
import { successResponse, errorResponse } from "../utils/response";
import { error } from "console";

export const createContactUs = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { email, name, phone, message } = req.body;
        
        const contact = await prisma.contactUs.create({
            data:{
                name: name,
                email: email,
                phone: phone, 
                message: message
            }
        })
        if (!contact){
            return res.status(StatusCodes.BAD_REQUEST).json(error("Contact us couldn't be submitted."));
        }
        try {
            const sendUser = sendContactUsConfirmation(email, name, message);
            const sendAdmin = sendContactUsAdminNotification(name, email, phone, message);
        } catch (error) {
            return res.status(400).json({
                success: false,
                message: "Error sending a mail. Your contact us record has been submitted."
            })
        }
        return res.status(StatusCodes.OK).json(successResponse("Contact us submitted successfully.", contact));

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Error creating contact us."
        })
    }
}

export const getAllContactUs = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { search, order } = req.query;
        const contact = await prisma.contactUs.findMany({
            where: search
            ? {
                OR: [
                {
                    name:{
                        contains: String(search),
                        mode: "insensitive"
                    }
                },
                {
                    email: {
                        contains: String(search),
                        mode: "insensitive"
                    }
                }
            ]
        } : undefined,
        orderBy :{ 
            createdAt: order === "asc" ? "asc" : "desc"
        }
        })
        if (!contact){
            return res.status(StatusCodes.NOT_FOUND).json(error("Contact us data not found."))
        }
        return res.status(StatusCodes.OK).json(errorResponse("Contact Us fetched successfully.", contact))
    } catch (error: any) {
        return res.status(StatusCodes.OK).json(errorResponse("Internal server error", error.message));
    }
}

export const notifyMerchant = async (req: Request, res: Response) => {
    try {
        const { name, email, merchantId } = req.body;
        const merchant = await prisma.merchantProfile.findFirst({
            where:{
                id: merchantId
            },include:{
                user: true
            }
        });
        if (!merchant){
            return res.status(StatusCodes.NOT_FOUND).json(errorResponse("Merchant not found with the given id."));
        }
        const purchase_intent = await prisma.giftCard_Purchase_Intent.create({
            data:{
                customerName: name,
                customerEmail: email,
                merchantId: merchantId
            }
        });
        if (!purchase_intent){
            return res.status(StatusCodes.BAD_REQUEST).json(errorResponse("Failed to notify merchant."));
        }
        try {
            console.log(merchant.user.email, merchant.user.name);
            const sendMail = sendMerchantNotificationEmail(merchant.user.email, merchant.user.name, name, email);
        } catch (error: any) {
            return res.status(StatusCodes.OK).json(errorResponse("Error sending email, but your response has been saved.", error.message));
        }
        return res.status(StatusCodes.OK).json(successResponse("Successfully notified merchant.", purchase_intent));
    } catch (error: any) {
        return res.status(StatusCodes.OK).json(errorResponse("Internal server error", error.message));
    }
}