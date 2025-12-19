import { Request, Response, NextFunction } from "express";
import { handlePrismaError } from "../utils/prismaErrorHandler";

export const errorHandler = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const prismaError = handlePrismaError(err);

  if (prismaError) {
    return res.status(prismaError.statusCode).json({
      success: false,
      message: prismaError.message,
    });
  }

  // Fallback (unknown error)
  console.error(err);

  return res.status(500).json({
    success: false,
    message: "Internal server error",
  });
};
