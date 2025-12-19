import { Role } from '@prisma/client';

declare global {
  namespace Express {
    interface Request {
      id: string;
      email: string;
      role: Role;
      isActive: boolean;
      emailVerified: boolean;
      name: string;l
      phone?: string | nul;
      avatar?: string | null;
    }
  }
}

export {}