
import { Request, Response, NextFunction } from 'express';
import { AnyZodObject, ZodError } from 'zod';

type ValidationType = 'body' | 'query' | 'params';

export const validate = (
  schema: AnyZodObject,
  type: ValidationType = 'body'
) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const dataToValidate = req[type];
      const validated = await schema.parseAsync(dataToValidate);
      
      
      req[type] = validated;
      
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const errorMessages = error.errors.map((err) => ({
          field: err.path.join('.'),
          message: err.message,
        }));

        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errorMessages,
        });
      }

      return res.status(500).json({
        success: false,
        message: 'Internal server error during validation',
      });
    }
  };
};


export const validateBody = (schema: AnyZodObject) => validate(schema, 'body');
export const validateQuery = (schema: AnyZodObject) => validate(schema, 'query');
export const validateParams = (schema: AnyZodObject) => validate(schema, 'params');