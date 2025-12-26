// src/config/swagger.config.ts

import swaggerJsdoc from "swagger-jsdoc";
import path from "path";

// Get absolute path to routes directory
const routesDir = path.join(__dirname, "..", "routes", "**/*.routes.ts");

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Thnx Digital API",
      version: "1.0.0",
      description: "API documentation for Thnx Digital Gift Card Platform",
      contact: {
        name: "Thnx Digital Support",
        url: "http://thnxdigital.com",
        email: "support@thnxdigital.com",
      },
      license: {
        name: "MIT",
      },
    },
    servers: [
      {
        url: "http://localhost:3000",
        description: "Development server",
      },
      {
        url: "http://thnxdigital.com",
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
        // ==================== User Schemas ====================
        User: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid", example: "550e8400-e29b-41d4-a716-446655440000" },
            email: { type: "string", format: "email", example: "user@example.com" },
            name: { type: "string", example: "John Doe" },
            phone: { type: "string", nullable: true, example: "+1234567890" },
            role: {
              type: "string",
              enum: ["USER", "MERCHANT", "ADMIN"],
              example: "MERCHANT",
            },
            isActive: { type: "boolean", example: true },
            provider: { type: "string", enum: ["local", "google"], example: "local" },
            avatar: { type: "string", nullable: true },
            bio: { type: "string", nullable: true },
            emailVerified: { type: "boolean", example: true },
            createdAt: { type: "string", format: "date-time" },
            updatedAt: { type: "string", format: "date-time" },
            lastLogin: { type: "string", format: "date-time", nullable: true },
          },
        },

        // ==================== Merchant Profile Schemas ====================
        MerchantProfile: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            userId: { type: "string", format: "uuid" },
            // Business Information
            businessName: { type: "string", example: "Acme Corporation" },
            businessRegistrationNumber: { type: "string", nullable: true },
            taxId: { type: "string", nullable: true },
            businessType: { type: "string", nullable: true, example: "LLC" },
            businessCategory: { type: "string", nullable: true, example: "Retail" },
            // Business Address
            address: { type: "string", nullable: true, example: "123 Main Street" },
            city: { type: "string", nullable: true, example: "New York" },
            state: { type: "string", nullable: true, example: "NY" },
            zipCode: { type: "string", nullable: true, example: "10001" },
            country: { type: "string", nullable: true, example: "USA" },
            // Business Contact
            businessPhone: { type: "string", nullable: true, example: "+1234567890" },
            businessEmail: { type: "string", format: "email", nullable: true },
            website: { type: "string", nullable: true, example: "https://acme.com" },
            // Documents
            registrationDocument: { type: "string", nullable: true },
            taxDocument: { type: "string", nullable: true },
            identityDocument: { type: "string", nullable: true },
            additionalDocuments: { type: "array", items: { type: "string" }, nullable: true },
            // Bank Details
            bankName: { type: "string", nullable: true },
            accountNumber: { type: "string", nullable: true },
            accountHolderName: { type: "string", nullable: true },
            ifscCode: { type: "string", nullable: true },
            swiftCode: { type: "string", nullable: true },
            // Status
            profileStatus: {
              type: "string",
              enum: ["INCOMPLETE", "PENDING_VERIFICATION", "VERIFIED", "REJECTED"],
              example: "VERIFIED",
            },
            isVerified: { type: "boolean", example: true },
            verifiedAt: { type: "string", format: "date-time", nullable: true },
            verifiedById: { type: "string", format: "uuid", nullable: true },
            verificationNotes: { type: "string", nullable: true },
            rejectionReason: { type: "string", nullable: true },
            rejectedAt: { type: "string", format: "date-time", nullable: true },
            // Additional
            description: { type: "string", nullable: true },
            logo: { type: "string", nullable: true },
            // Timestamps
            createdAt: { type: "string", format: "date-time" },
            updatedAt: { type: "string", format: "date-time" },
            // Relations
            user: { $ref: "#/components/schemas/User" },
          },
        },

        // ==================== Gift Card Schemas ====================
        GiftCard: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            merchantId: { type: "string", format: "uuid" },
            title: { type: "string", example: "Holiday Gift Card" },
            description: { type: "string", nullable: true },
            price: { type: "number", format: "decimal", example: 50.0 },
            expiryDate: { type: "string", format: "date-time" },
            isActive: { type: "boolean", example: true },
            createdAt: { type: "string", format: "date-time" },
            updatedAt: { type: "string", format: "date-time" },
          },
        },

        PurchasedGiftCard: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            giftCardId: { type: "string", format: "uuid" },
            qrCode: { type: "string", example: "GC-ABC123XYZ" },
            customerName: { type: "string", example: "Jane Smith" },
            customerEmail: { type: "string", format: "email" },
            customerPhone: { type: "string" },
            purchaseAmount: { type: "number", format: "decimal", example: 50.0 },
            currentBalance: { type: "number", format: "decimal", example: 35.0 },
            status: {
              type: "string",
              enum: ["ACTIVE", "FULLY_REDEEMED", "EXPIRED", "CANCELLED"],
              example: "ACTIVE",
            },
            paymentStatus: {
              type: "string",
              enum: ["PENDING", "COMPLETED", "FAILED", "REFUNDED"],
              example: "COMPLETED",
            },
            paymentMethod: { type: "string", nullable: true },
            transactionId: { type: "string", nullable: true },
            purchasedAt: { type: "string", format: "date-time" },
            expiresAt: { type: "string", format: "date-time" },
            lastUsedAt: { type: "string", format: "date-time", nullable: true },
          },
        },

        Redemption: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            purchasedGiftCardId: { type: "string", format: "uuid" },
            redeemedById: { type: "string", format: "uuid" },
            amount: { type: "number", format: "decimal", example: 15.0 },
            balanceBefore: { type: "number", format: "decimal", example: 50.0 },
            balanceAfter: { type: "number", format: "decimal", example: 35.0 },
            locationName: { type: "string", nullable: true },
            locationAddress: { type: "string", nullable: true },
            notes: { type: "string", nullable: true },
            redeemedAt: { type: "string", format: "date-time" },
          },
        },

        // ==================== Request Schemas ====================
        
        // Auth Requests
        LoginRequest: {
          type: "object",
          required: ["email", "password"],
          properties: {
            email: { type: "string", format: "email", example: "user@example.com" },
            password: { type: "string", example: "password123" },
          },
        },

        RegisterRequest: {
          type: "object",
          required: ["email", "password", "name"],
          properties: {
            email: { type: "string", format: "email", example: "newuser@example.com" },
            password: { type: "string", minLength: 8, example: "SecurePass123!" },
            name: { type: "string", example: "John Doe" },
            phone: { type: "string", example: "+1234567890" },
          },
        },

        // Merchant Requests
        MerchantQuickRegisterRequest: {
          type: "object",
          required: ["email", "password", "name", "businessName"],
          properties: {
            email: { type: "string", format: "email", example: "merchant@business.com" },
            password: { type: "string", minLength: 8, example: "SecurePass123!" },
            name: { type: "string", example: "John Smith" },
            phone: { type: "string", example: "+1234567890" },
            businessName: { type: "string", example: "Smith's Store" },
          },
        },

        CreateMerchantRequest: {
          type: "object",
          required: ["email", "password", "name", "businessName"],
          properties: {
            email: { type: "string", format: "email", example: "newmerchant@example.com" },
            password: { type: "string", minLength: 8, example: "SecurePass123!" },
            name: { type: "string", example: "John Smith" },
            phone: { type: "string", example: "+1234567890" },
            businessName: { type: "string", example: "New Business LLC" },
            businessRegistrationNumber: { type: "string", example: "REG123456" },
            taxId: { type: "string", example: "TAX123456" },
            businessType: { type: "string", example: "LLC" },
            businessCategory: { type: "string", example: "Retail" },
            address: { type: "string", example: "123 Business Ave" },
            city: { type: "string", example: "New York" },
            state: { type: "string", example: "NY" },
            zipCode: { type: "string", example: "10001" },
            country: { type: "string", example: "USA" },
            businessPhone: { type: "string", example: "+1234567890" },
            businessEmail: { type: "string", format: "email", example: "contact@business.com" },
            website: { type: "string", example: "https://business.com" },
            description: { type: "string", example: "A great business" },
          },
        },

        CompleteProfileRequest: {
          type: "object",
          required: ["address", "city", "country", "businessPhone", "businessEmail", "bankName", "accountNumber", "accountHolderName"],
          properties: {
            businessRegistrationNumber: { type: "string" },
            taxId: { type: "string" },
            businessType: { type: "string" },
            businessCategory: { type: "string" },
            address: { type: "string" },
            city: { type: "string" },
            state: { type: "string" },
            zipCode: { type: "string" },
            country: { type: "string" },
            businessPhone: { type: "string" },
            businessEmail: { type: "string", format: "email" },
            website: { type: "string" },
            description: { type: "string" },
            bankName: { type: "string" },
            accountNumber: { type: "string" },
            accountHolderName: { type: "string" },
            ifscCode: { type: "string" },
            swiftCode: { type: "string" },
          },
        },

        VerifyMerchantRequest: {
          type: "object",
          required: ["action"],
          properties: {
            action: {
              type: "string",
              enum: ["approve", "reject"],
              example: "approve",
              description: "Action to perform on the merchant",
            },
            rejectionReason: {
              type: "string",
              example: "Documents are unclear or invalid",
              description: "Required when action is 'reject'",
            },
            verificationNotes: {
              type: "string",
              example: "All documents verified successfully",
              description: "Optional notes for the verification",
            },
          },
        },

        DeleteMerchantRequest: {
          type: "object",
          properties: {
            hardDelete: {
              type: "boolean",
              default: false,
              example: false,
              description: "If true, permanently deletes. If false, only deactivates.",
            },
          },
        },

        UpdateProfileRequest: {
          type: "object",
          properties: {
            description: { type: "string", example: "Updated business description" },
            website: { type: "string", example: "https://newwebsite.com" },
            logo: { type: "string", example: "https://example.com/logo.png" },
          },
        },

        // Gift Card Requests
        CreateGiftCardRequest: {
          type: "object",
          required: ["title", "price", "expiryDate"],
          properties: {
            title: { type: "string", example: "Holiday Special Gift Card" },
            description: { type: "string", example: "Perfect gift for the holidays" },
            price: { type: "number", format: "decimal", example: 50.0 },
            expiryDate: { type: "string", format: "date-time" },
          },
        },

        PurchaseGiftCardRequest: {
          type: "object",
          required: ["giftCardId", "customerName", "customerEmail", "customerPhone"],
          properties: {
            giftCardId: { type: "string", format: "uuid" },
            customerName: { type: "string", example: "Jane Smith" },
            customerEmail: { type: "string", format: "email", example: "jane@example.com" },
            customerPhone: { type: "string", example: "+1234567890" },
            paymentMethod: { type: "string", example: "card" },
          },
        },

        RedeemGiftCardRequest: {
          type: "object",
          required: ["qrCode", "amount"],
          properties: {
            qrCode: { type: "string", example: "GC-ABC123XYZ" },
            amount: { type: "number", format: "decimal", example: 15.0 },
            locationName: { type: "string", example: "Main Store" },
            locationAddress: { type: "string", example: "123 Main St" },
            notes: { type: "string", example: "Coffee purchase" },
          },
        },

        // ==================== Response Schemas ====================
        SuccessResponse: {
          type: "object",
          properties: {
            success: { type: "boolean", example: true },
            message: { type: "string", example: "Operation successful" },
            data: { type: "object" },
          },
        },

        ErrorResponse: {
          type: "object",
          properties: {
            success: { type: "boolean", example: false },
            message: { type: "string", example: "Error message" },
            error: { type: "string" },
          },
        },

        AuthResponse: {
          type: "object",
          properties: {
            success: { type: "boolean", example: true },
            message: { type: "string", example: "Login successful" },
            data: {
              type: "object",
              properties: {
                user: { $ref: "#/components/schemas/User" },
                tokens: {
                  type: "object",
                  properties: {
                    accessToken: { type: "string" },
                    refreshToken: { type: "string" },
                  },
                },
              },
            },
          },
        },

        MerchantsListResponse: {
          type: "object",
          properties: {
            success: { type: "boolean", example: true },
            data: {
              type: "object",
              properties: {
                merchants: {
                  type: "array",
                  items: { $ref: "#/components/schemas/MerchantProfile" },
                },
                count: { type: "number", example: 10 },
              },
            },
          },
        },

        ProfileStatsResponse: {
          type: "object",
          properties: {
            success: { type: "boolean", example: true },
            data: {
              type: "object",
              properties: {
                profile: { $ref: "#/components/schemas/MerchantProfile" },
                stats: {
                  type: "object",
                  properties: {
                    completionPercentage: { type: "number", example: 100 },
                    missingFields: {
                      type: "array",
                      items: { type: "string" },
                      example: [],
                    },
                    isComplete: { type: "boolean", example: true },
                    isPending: { type: "boolean", example: false },
                    isVerified: { type: "boolean", example: true },
                    isRejected: { type: "boolean", example: false },
                  },
                },
              },
            },
          },
        },
        GetOtpRequest: {
        type: "object",
        required: ["email"],
        properties: {
          email: {
            type: "string",
            format: "email",
            example: "user@example.com",
          },
        },
      },VerifyOtpRequest: {
          type: "object",
          required: ["email", "otp"],
          properties: {
            email: {
              type: "string",
              format: "email",
              example: "user@example.com",
            },
            otp: {
              type: "string",
              example: "123456",
              description: "OTP sent to user's email",
            },
          },
        },
        ChangePasswordRequest: {
          type: "object",
          required: ["email", "otp", "password", "confirmPassword"],
          properties: {
            email: {
              type: "string",
              format: "email",
              example: "user@example.com",
            },
            otp: {
              type: "string",
              example: "123456",
            },
            password: {
              type: "string",
              example: "Password@123",
              description: "New password",
            },
            confirmPassword: {
              type: "string",
              example: "Password@123",
            },
          },
        },
        ResetPasswordRequest: {
          type: "object",
          required: ["password", "newPassword", "confirmPassword"],
          properties: {
            password: {
              type: "string",
              example: "OldPassword@123",
              description: "Current password",
            },
            newPassword: {
              type: "string",
              example: "NewPassword@123",
            },
            confirmPassword: {
              type: "string",
              example: "NewPassword@123",
            },
          },
        },
        GoogleLoginRequest: {
          type: "object",
          required: ["credential"],
          properties: {
            credential: {
              type: "string",
              description: "Google ID token",
              example: "eyJhbGciOiJSUzI1NiIsImtpZCI6Ij...",
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
                type: "object",
                properties: {
                  success: { type: "boolean", example: false },
                  message: { type: "string", example: "Unauthorized - Invalid or missing token" },
                },
              },
            },
          },
        },
        ForbiddenError: {
          description: "Access denied - insufficient permissions",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  success: { type: "boolean", example: false },
                  message: { type: "string", example: "Access denied - Admin role required" },
                },
              },
            },
          },
        },
        NotFoundError: {
          description: "Resource not found",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  success: { type: "boolean", example: false },
                  message: { type: "string", example: "Resource not found" },
                },
              },
            },
          },
        },
        ValidationError: {
          description: "Validation error",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  success: { type: "boolean", example: false },
                  message: { type: "string", example: "Validation error" },
                  errors: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        field: { type: "string" },
                        message: { type: "string" },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        InternalServerError: {
          description: "Internal server error",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  success: { type: "boolean", example: false },
                  message: { type: "string", example: "Internal server error" },
                  error: { type: "string" },
                },
              },
            },
          },
        },
      },
    },
    tags: [
      { name: "Auth", description: "Authentication endpoints (login, register, OAuth)" },
      { name: "Merchants - Self Service", description: "Merchant self-service endpoints (profile, resubmit)" },
      { name: "Merchants - Admin", description: "Admin merchant management (create, verify, delete)" },
      { name: "Gift Cards", description: "Gift card CRUD operations" },
      { name: "Purchases", description: "Gift card purchase and redemption" },
    ],
  },
  apis: [
        path.join(process.cwd(), "src", "**/*.routes.ts"),
    ],
};

// Debug logging
console.log("📚 Swagger Config:");
console.log("   Routes directory:", routesDir);
console.log("   Scanning pattern:", path.join(routesDir, "*.js"));

const swaggerSpec = swaggerJsdoc(options) as swaggerJsdoc.SwaggerDefinition & {
  paths?: Record<string, unknown>;
};

// Log results
const pathCount = Object.keys(swaggerSpec.paths || {}).length;
console.log("   Paths found:", pathCount);

if (pathCount === 0) {
  console.warn("⚠️  No API paths found! Check that route files have JSDoc comments.");
}

export default swaggerSpec;