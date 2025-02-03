import { prisma } from '@/lib/prisma';

export async function checkLicense(email: string): Promise<boolean> {
  try {
    const subscription = await prisma.userSubscription.findUnique({
      where: { userId: email }
    });

    return Boolean(
      subscription?.licenseKey && 
      (!subscription.licenseExpiresAt || subscription.licenseExpiresAt > new Date())
    );
  } catch (error) {
    console.error('Error checking license:', error);
    return false;
  }
} 