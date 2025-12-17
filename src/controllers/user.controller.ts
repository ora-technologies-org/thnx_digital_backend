import { NextFunction, Request, Response } from "express";
import { createContactUsSchema } from "../validators/user.validator";
import prisma from "../utils/prisma.util";
import { sendContactUsAdminNotification, sendContactUsConfirmation } from "../utils/email.util";
import { mode } from "crypto-js";

export const createContactUs = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const parsedData = createContactUsSchema.safeParse(req.body);
        if (!parsedData.success) {
            const errors = parsedData.error.issues.map((issue) => ({
                field: issue.path[0],
                message: issue.message,
            }));

            return res.status(400).json({
                success: false,
                errors,
            });
        }

        const { email, name, phone, message } = parsedData.data;
        
        const contact = await prisma.contactUs.create({
            data:{
                name: name,
                email: email,
                phone: phone, 
                message: message
            }
        })
        if (!contact){
            return res.status(400).json({
                message: "Contact us couldn't be created."
            });
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
        return res.status(200).json({
            success: true,
            message: "Contact us submitted successfully.",
            data: contact
        })

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
            return res.status(400).json({
                success: false,
                message: "Contact us data not found."
            })
        }
        return res.status(200).json({
            success: true,
            message: "Contact Us fetched successfully.",
            data: contact
        })
    } catch (error) {
        
    }
}