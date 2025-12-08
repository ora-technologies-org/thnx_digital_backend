declare global {
  namespace Express {
    interface User {
      userId: string;
      email: string;
      role: string;
      isVerified: boolean;
      profileStatus?: string;
    }
  }
}

export {}