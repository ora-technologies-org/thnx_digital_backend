import { Request, Response, NextFunction } from "express";
import prisma from "../utils/prisma.util";
import { updateAdminProfileSchema } from "../validators/admin.validators";
import { StatusCodes } from "../utils/statusCodes";
import { successResponse, errorResponse } from "../utils/response";

export const updateProfile = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = req.authUser?.userId;
        
        const updateData = req.body;

        if (Object.keys(updateData).length === 0) {
            return res.status(StatusCodes.BAD_REQUEST).json(errorResponse("At least one field is required to update"));
        }
        
        const admin = await prisma.user.update({
            where: {
                id: userId
            },
            data: updateData
        });
        if (!admin){
            return res.status(StatusCodes.BAD_REQUEST).json(errorResponse("Your profile couldn't be updated."))
        }
        const { password ,provider ,googleId ,createdAt ,updatedAt ,lastLogin ,emailVerified ,verificationToken ,resetToken ,resetTokenExpiry ,isFirstTime ,createdById , ...rest} = admin
        return res.status(StatusCodes.OK).json(successResponse("Profile updated successfully", rest));
        
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Error updating admin profile."
        });
    }
}