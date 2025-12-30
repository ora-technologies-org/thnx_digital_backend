import { ZodSchema } from "zod";
import { Request, Response, NextFunction } from "express";
import { StatusCodes } from "../utils/statusCodes";
import { error } from "console";

export const validate = (schema: ZodSchema) =>
(req: Request, res: Response, next: NextFunction) => {
    const  parsedData = schema.safeParse(req.body);

    if (!parsedData.success){
        const errors = parsedData.error.issues.map(issue => ({
            field: issue.path[0],
            message: issue.message
        }));
        return res.status(StatusCodes.BAD_REQUEST).json({
            success: false,
            errors
        });
    }

    req.body = parsedData.data;
    next();
}

export const queryValidation = (schema: ZodSchema) => (req: Request, res: Response, next: NextFunction) => {
    const parsedData = schema.safeParse(req.query);

    if (!parsedData.success){
        const errors = parsedData.error.issues.map(issue=> ({
            field: issue.path[0],
            message: issue.message
        }));
        return res.status(StatusCodes.BAD_REQUEST).json({
            success: false,
            errors
        });
    }
    req.query = parsedData.data;
    next();
}