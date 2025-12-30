import { ZodSchema } from "zod";
import { Request, Response, NextFunction } from "express";

export const validate = (schema: ZodSchema) =>
(req: Request, res: Response, next: NextFunction) => {
    const  parsedData = schema.safeParse(req.body);

    if (!parsedData.success){
        const errors = parsedData.error.issues.map(issue => ({
            field: issue.path[0],
            message: issue.message
        }));
        return res.status(400).json({
            success: false,
            errors
        });
    }

    req.body = parsedData.data;
    next();
}