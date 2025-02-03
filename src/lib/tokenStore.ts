import { prisma } from './prisma';

interface TokenInfo {
  accessToken: string;
  expiresAt: Date;
}

// Store token for a specific user
export async function storeToken(userId: string, tokenInfo: TokenInfo) {
  try {
    // Store in global token for background tasks
    await prisma.token.upsert({
      where: { id: 'global' },
      update: { value: tokenInfo.accessToken },
      create: { id: 'global', value: tokenInfo.accessToken }
    });
    console.log('Stored new token for user:', userId);
  } catch (error) {
    console.error('Error storing user token:', error);
    throw error;
  }
}

// Store global token (for background tasks)
export async function storeGlobalToken(token: string) {
  try {
    await prisma.token.upsert({
      where: { id: 'global' },
      update: { value: token },
      create: { id: 'global', value: token }
    });
    console.log('Stored new global token');
  } catch (error) {
    console.error('Error storing global token:', error);
    throw error;
  }
}

// Get token for a specific user - now uses global token
export async function getValidToken(userId: string): Promise<string | null> {
  try {
    const token = await prisma.token.findUnique({
      where: { id: 'global' }
    });
    return token?.value || null;
  } catch (error) {
    console.error('Error getting valid token:', error);
    return null;
  }
}

// Get global token (for background tasks)
export async function getStoredToken(): Promise<string | null> {
  try {
    const token = await prisma.token.findUnique({
      where: { id: 'global' }
    });
    return token?.value || null;
  } catch (error) {
    console.error('Error getting stored token:', error);
    return null;
  }
}