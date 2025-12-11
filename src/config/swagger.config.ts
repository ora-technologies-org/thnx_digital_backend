// src/config/swagger.config.ts

import swaggerJsdoc from "swagger-jsdoc";

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Thnx Digital API",
      version: "1.0.0",
      description: "API documentation for Thnx Digital Gift Card Platform",
      contact: {
        name: "Thnx Digital Support",
        email: "support@thnxdigital.com",
        url: "https://thnxdigital.com",
      },
      license: {
        name: "MIT",
        url: "https://opensource.org/licenses/MIT",
      },
    },
    servers: [
      {
        url: "http://localhost:3000",
        description: "Development server",
      },
      {
        url: "https://thnxdigital.com",
        description: "Production server",
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
          description: "Enter your JWT token",
        },
      },
      schemas: {
        // User Schema
        User: {
          type: "object",
          properties: {
            id: {
              type: "string",
              description: "User ID",
              example: "clxx1234567890",
            },
            email: {
              type: "string",
              format: "email",
              description: "User email",
              example: "user@example.com",
            },
            name: {
              type: "string",
              description: "User name",
              example: "John Doe",
            },
            phone: {
              type: "string",
              description: "Phone number",
              example: "+91-9876543210",
            },
            role: {
              type: "string",
              enum: ["USER", "MERCHANT", "ADMIN"],
              description: "User role",
              example: "MERCHANT",
            },
            isActive: {
              type: "boolean",
              description: "Account status",
              example: true,
            },
            createdAt: {
              type: "string",
              format: "date-time",
              description: "Account creation date",
            },
          },
        },

        // Merchant Profile Schema
        MerchantProfile: {
          type: "object",
          properties: {
            id: {
              type: "string",
              description: "Profile ID",
              example: "clxx1234567890",
            },
            userId: {
              type: "string",
              description: "User ID",
              example: "clxx1234567890",
            },
            businessName: {
              type: "string",
              description: "Business name",
              example: "ABC Store",
            },
            businessRegistrationNumber: {
              type: "string",
              description: "Business registration number",
              example: "REG123456",
            },
            taxId: {
              type: "string",
              description: "Tax ID",
              example: "TAX789012",
            },
            businessType: {
              type: "string",
              description: "Type of business",
              example: "RETAIL",
            },
            businessCategory: {
              type: "string",
              description: "Business category",
              example: "FASHION",
            },
            address: {
              type: "string",
              description: "Business address",
              example: "123 Main Street",
            },
            city: {
              type: "string",
              description: "City",
              example: "Mumbai",
            },
            state: {
              type: "string",
              description: "State",
              example: "Maharashtra",
            },
            zipCode: {
              type: "string",
              description: "ZIP/Postal code",
              example: "400001",
            },
            country: {
              type: "string",
              description: "Country",
              example: "India",
            },
            businessPhone: {
              type: "string",
              description: "Business phone",
              example: "+91-9876543210",
            },
            businessEmail: {
              type: "string",
              format: "email",
              description: "Business email",
              example: "contact@abcstore.com",
            },
            website: {
              type: "string",
              description: "Website URL",
              example: "https://abcstore.com",
            },
            description: {
              type: "string",
              description: "Business description",
              example: "Premium retail store",
            },
            logo: {
              type: "string",
              description: "Logo URL",
              example: "https://cdn.example.com/logo.png",
            },
            profileStatus: {
              type: "string",
              enum: ["INCOMPLETE", "PENDING_VERIFICATION", "VERIFIED", "REJECTED"],
              description: "Profile verification status",
              example: "VERIFIED",
            },
            isVerified: {
              type: "boolean",
              description: "Verification status",
              example: true,
            },
            verifiedAt: {
              type: "string",
              format: "date-time",
              description: "Verification date",
            },
            rejectionReason: {
              type: "string",
              description: "Reason for rejection",
              example: "Documents unclear",
            },
            rejectedAt: {
              type: "string",
              format: "date-time",
              description: "Rejection date",
            },
          },
        },

        // Create Merchant Request
        CreateMerchantRequest: {
          type: "object",
          required: ["email", "password", "name", "businessName"],
          properties: {
            email: {
              type: "string",
              format: "email",
              example: "newmerchant@example.com",
            },
            password: {
              type: "string",
              minLength: 8,
              example: "SecurePass123!",
            },
            name: {
              type: "string",
              example: "Jane Smith",
            },
            phone: {
              type: "string",
              example: "+91-9876543210",
            },
            businessName: {
              type: "string",
              example: "Jane's Boutique",
            },
            businessRegistrationNumber: {
              type: "string",
              example: "REG123456",
            },
            taxId: {
              type: "string",
              example: "TAX789012",
            },
            businessType: {
              type: "string",
              example: "RETAIL",
            },
            businessCategory: {
              type: "string",
              example: "FASHION",
            },
            address: {
              type: "string",
              example: "456 Market Street",
            },
            city: {
              type: "string",
              example: "Delhi",
            },
            state: {
              type: "string",
              example: "Delhi",
            },
            zipCode: {
              type: "string",
              example: "110001",
            },
            country: {
              type: "string",
              example: "India",
            },
            businessPhone: {
              type: "string",
              example: "+91-9876543211",
            },
            businessEmail: {
              type: "string",
              format: "email",
              example: "contact@janesboutique.com",
            },
            website: {
              type: "string",
              example: "https://janesboutique.com",
            },
            description: {
              type: "string",
              example: "Premium fashion boutique",
            },
          },
        },

        // Update Profile Request
        UpdateProfileRequest: {
          type: "object",
          properties: {
            description: {
              type: "string",
              example: "Updated business description",
            },
            website: {
              type: "string",
              example: "https://newwebsite.com",
            },
            logo: {
              type: "string",
              example: "https://cdn.example.com/logo.png",
            },
          },
        },

        // Verify Merchant Request
        VerifyMerchantRequest: {
          type: "object",
          required: ["action"],
          properties: {
            action: {
              type: "string",
              enum: ["approve", "reject"],
              example: "approve",
            },
            rejectionReason: {
              type: "string",
              description: "Required if action is reject",
              example: "Identity document is unclear",
            },
            verificationNotes: {
              type: "string",
              example: "All documents verified successfully",
            },
          },
        },

        // Delete Merchant Request
        DeleteMerchantRequest: {
          type: "object",
          properties: {
            hardDelete: {
              type: "boolean",
              default: false,
              description: "If true, permanently delete. If false, soft delete (deactivate).",
              example: false,
            },
          },
        },

        // Success Response
        SuccessResponse: {
          type: "object",
          properties: {
            success: {
              type: "boolean",
              example: true,
            },
            message: {
              type: "string",
              example: "Operation successful",
            },
            data: {
              type: "object",
            },
          },
        },

        // Error Response
        ErrorResponse: {
          type: "object",
          properties: {
            success: {
              type: "boolean",
              example: false,
            },
            message: {
              type: "string",
              example: "Error message",
            },
            error: {
              type: "string",
              example: "Detailed error description",
            },
          },
        },

        // Validation Error Response
        ValidationErrorResponse: {
          type: "object",
          properties: {
            success: {
              type: "boolean",
              example: false,
            },
            message: {
              type: "string",
              example: "Validation error",
            },
            errors: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  code: {
                    type: "string",
                    example: "invalid_type",
                  },
                  expected: {
                    type: "string",
                    example: "string",
                  },
                  received: {
                    type: "string",
                    example: "undefined",
                  },
                  path: {
                    type: "array",
                    items: {
                      type: "string",
                    },
                    example: ["email"],
                  },
                  message: {
                    type: "string",
                    example: "Required",
                  },
                },
              },
            },
          },
        },

        // Login Request
        LoginRequest: {
          type: "object",
          required: ["email", "password"],
          properties: {
            email: {
              type: "string",
              format: "email",
              example: "user@example.com",
            },
            password: {
              type: "string",
              example: "Password123!",
            },
          },
        },

        // Login Response
        LoginResponse: {
          type: "object",
          properties: {
            success: {
              type: "boolean",
              example: true,
            },
            message: {
              type: "string",
              example: "Login successful",
            },
            data: {
              type: "object",
              properties: {
                user: {
                  $ref: "#/components/schemas/User",
                },
                tokens: {
                  type: "object",
                  properties: {
                    accessToken: {
                      type: "string",
                      example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
                    },
                    refreshToken: {
                      type: "string",
                      example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
                    },
                  },
                },
              },
            },
          },
        },

        // Tokens
        Tokens: {
          type: "object",
          properties: {
            accessToken: {
              type: "string",
              example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
            },
            refreshToken: {
              type: "string",
              example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
            },
          },
        },
      },
      responses: {
        UnauthorizedError: {
          description: "Access token is missing or invalid",
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/ErrorResponse",
              },
              example: {
                success: false,
                message: "Unauthorized",
              },
            },
          },
        },
        ForbiddenError: {
          description: "Insufficient permissions",
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/ErrorResponse",
              },
              example: {
                success: false,
                message: "Access denied. Insufficient permissions.",
              },
            },
          },
        },
        NotFoundError: {
          description: "Resource not found",
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/ErrorResponse",
              },
              example: {
                success: false,
                message: "Resource not found",
              },
            },
          },
        },
        ValidationError: {
          description: "Validation error",
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/ValidationErrorResponse",
              },
            },
          },
        },
        InternalServerError: {
          description: "Internal server error",
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/ErrorResponse",
              },
              example: {
                success: false,
                message: "Internal server error",
                error: "Error details",
              },
            },
          },
        },
      },
    },
    tags: [
      {
        name: "Auth",
        description: "Authentication endpoints",
      },
      {
        name: "Merchants - Self Service",
        description: "Merchant self-service endpoints",
      },
      {
        name: "Merchants - Admin",
        description: "Admin merchant management endpoints",
      },
      {
        name: "Gift Cards",
        description: "Gift card management endpoints",
      },
      {
        name: "Purchases",
        description: "Purchase management endpoints",
      },
    ],
  },
  apis: ["./src/routes/*.ts", "./src/controllers/*.ts"],
};

const swaggerSpec = swaggerJsdoc(options);

export default swaggerSpec;