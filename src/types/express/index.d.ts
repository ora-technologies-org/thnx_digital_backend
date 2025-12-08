import { Role } from '@prisma/client';

declare global {
  namespace Express {
    interface User {
      id: string;
      email: string;
      role: Role;
      isActive: boolean;
      emailVerified: boolean;
      name: string;
      phone?: string | null;
      avatar?: string | null;
    }
  }
}

export {}