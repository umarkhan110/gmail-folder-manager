import { prisma } from './prisma';
import { refreshAccessToken } from './refreshAccessToken';

interface TokenInfo {
  accessToken: string;
  expiresAt: Date;
}

// Store token for a specific user
export async function storeToken(userId: string, tokenInfo: TokenInfo & { refreshToken?: string }) {
  try {
    // Store in global token for background tasks
    await prisma.token.upsert({
      where: { userId },
      update: {
        accessToken: tokenInfo.accessToken,
        refreshToken: tokenInfo.refreshToken,
        expiresAt: tokenInfo.expiresAt,
      },
      create: {
        userId,
        accessToken: tokenInfo.accessToken,
        refreshToken: tokenInfo.refreshToken,
        expiresAt: tokenInfo.expiresAt,
      },
    });
    console.log('Stored new token for user:', userId);
  } catch (error) {
    console.error('Error storing user token:', error);
    throw error;
  }
}

// // Store global token (for background tasks)
// export async function storeGlobalToken(token: string) {
//   try {
//     await prisma.token.upsert({
//       where: { id: 'global' },
//       update: { value: token },
//       create: { id: 'global', value: token }
//     });
//     console.log('Stored new global token');
//   } catch (error) {
//     console.error('Error storing global token:', error);
//     throw error;
//   }
// }

// Get token for a specific user - now uses global token
export async function getValidToken(userId: string): Promise<string | null> {
  try {
    const token = await prisma.token.findUnique({
      where: { userId }
    });
    if (!token) return null;

    // Check if token is expired
    if (new Date() > token.expiresAt) return null;
    return token.accessToken;
  } catch (error) {
    console.error('Error getting valid token:', error);
    return null;
  }
}

// Get global token (for background tasks)
export async function getStoredToken(userId: string): Promise<string | null> {
  try {
    const token = await prisma.token.findUnique({
      where: { userId }
    });
    if (!token) return null;

    // Check if the token is expired
    if (new Date() > token.expiresAt) {
      console.log("🔄 Access token expired, refreshing...");

      const newToken = await refreshAccessToken(token.refreshToken);
      if (!newToken) return null;

      // Update the database with the new token
      await prisma.token.update({
        where: { userId },
        data: {
          accessToken: newToken.accessToken,
          expiresAt: newToken.expiresAt,
          refreshToken: newToken.refreshToken || token.refreshToken,
        },
      });

      return newToken.accessToken;
    }
    return token.accessToken;
  } catch (error) {
    console.error('Error getting stored token:', error);
    return null;
  }
}