import { Prisma } from "@prisma/client";

export const handlePrismaError = (error: unknown) => {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    switch (error.code) {
      case "P2002":
        return {
          statusCode: 409,
          message: `Duplicate value for ${error.meta?.target}`,
        };

      case "P2025":
        return {
          statusCode: 404,
          message: "Requested resource not found",
        };

      case "P2003":
        return {
          statusCode: 400,
          message: "Invalid foreign key reference",
        };

      default:
        return {
          statusCode: 400,
          message: "Database operation failed",
        };
    }
  }

  if (error instanceof Prisma.PrismaClientValidationError) {
    return {
      statusCode: 422,
      message: "Invalid input data",
    };
  }

  if (error instanceof Prisma.PrismaClientInitializationError) {
    return {
      statusCode: 500,
      message: "Database connection error",
    };
  }

  return null;
};
