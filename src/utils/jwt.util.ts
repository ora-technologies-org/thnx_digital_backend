import jwt from 'jsonwebtoken';

interface TokenPayload {
  userId: string;
  email: string;
  role: string;
  isVerified: boolean;
  profileStatus?: string;
}

interface AccessTokenPayload extends TokenPayload {}

interface RefreshTokenPayload {
  userId: string;
}

export const generateAccessToken = (payload: TokenPayload): string => {
  const secret = process.env.JWT_ACCESS_SECRET;

  if (!secret) {
    throw new Error('JWT_ACCESS_SECRET is not defined');
  }

  // @ts-ignore - TypeScript has issues with jwt.sign overloads
  return jwt.sign(
    {
      userId: payload.userId,
      email: payload.email,
      role: payload.role,
      isVerified: payload.isVerified,
      profileStatus: payload.profileStatus,
    },
    secret,
    {
      expiresIn: process.env.JWT_ACCESS_EXPIRY || '15m',
    }
  );
};

export const generateRefreshToken = (userId: string): string => {
  const secret = process.env.JWT_REFRESH_SECRET;

  if (!secret) {
    throw new Error('JWT_REFRESH_SECRET is not defined');
  }

  // @ts-ignore - TypeScript has issues with jwt.sign overloads
  return jwt.sign(
    { userId },
    secret,
    {
      expiresIn: process.env.JWT_REFRESH_EXPIRY || '7d',
    }
  );
};

export const verifyAccessToken = (token: string): AccessTokenPayload => {
  const secret = process.env.JWT_ACCESS_SECRET;

  if (!secret) {
    throw new Error('JWT_ACCESS_SECRET is not defined');
  }

  try {
    const decoded = jwt.verify(token, secret) as AccessTokenPayload;
    return decoded;
  } catch (error) {
    throw new Error('Invalid or expired access token');
  }
};

export const verifyRefreshToken = (token: string): RefreshTokenPayload => {
  const secret = process.env.JWT_REFRESH_SECRET;

  if (!secret) {
    throw new Error('JWT_REFRESH_SECRET is not defined');
  }

  try {
    const decoded = jwt.verify(token, secret) as RefreshTokenPayload;
    return decoded;
  } catch (error) {
    throw new Error('Invalid or expired refresh token');
  }
};

export const generateTokens = (payload: TokenPayload) => {
  const accessToken = generateAccessToken(payload);
  const refreshToken = generateRefreshToken(payload.userId);

  return {
    accessToken,
    refreshToken,
  };
};