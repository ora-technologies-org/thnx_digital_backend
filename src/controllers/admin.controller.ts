import { Request, Response, NextFunction } from "express";
import prisma from "../utils/prisma.util";
import { updateAdminProfileSchema } from "../validators/admin.validators";

export const updateAdminProfile = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = req.authUser?.userId;

        const allowedFields = ["name", "phone", "bio"];

        const sentFields = Object.keys(req.body);
        const invalidFields = sentFields.filter(
        (field) => !allowedFields.includes(field)
        );

        if (invalidFields.length > 0) {
        return res.status(400).json({
            success: false,
            message: `You cannot update the following fields: ${invalidFields.join(", ")}`,
        });
        }



        const parsed = updateAdminProfileSchema.safeParse(req.body);

        if (!parsed.success) {
        return res.status(400).json({
            success: false,
            message: "Validation failed",
            errors: parsed.error.flatten().fieldErrors,
        });
        }

        const updateData = parsed.data;

        if (Object.keys(updateData).length === 0) {
        return res.status(400).json({
            success: false,
            message: "At least one field is required to update",
        });
        }


        const admin = await prisma.user.update({
            where: {
                id: userId
            },
            data: updateData
        });
        if (!admin){
            return res.status(400).json({
                success: false,
                message: "Your profile couldn't be updated."
            })
        }
        const { password ,provider ,googleId ,createdAt ,updatedAt ,lastLogin ,emailVerified ,verificationToken ,resetToken ,resetTokenExpiry ,isFirstTime ,createdById , ...rest} = admin
        return res.status(200).json({
            success: true,
            message: "Profile updated successfully",
            data: rest
        });
        
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Error updating admin profile."
        });
    }
}