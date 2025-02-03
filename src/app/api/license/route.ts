import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { createMailSubscription } from '@/lib/subscriptionManager';
import { storeToken } from '@/lib/tokenStore';

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.accessToken || !session.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Store the token with proper expiration (1 hour from now by default)
    await storeToken(session.user.email, {
      accessToken: session.accessToken,
      expiresAt: new Date(Date.now() + 3600 * 1000) // 1 hour
    });

    const { licenseKey } = await request.json();
    if (!licenseKey) {
      return NextResponse.json({ error: 'License key is required' }, { status: 400 });
    }

    // Check if license exists and is valid
    const license = await prisma.license.findUnique({
      where: { key: licenseKey }
    });

    if (!license) {
      return NextResponse.json({ error: 'Invalid license key' }, { status: 400 });
    }

    if (license.expiresAt && license.expiresAt < new Date()) {
      return NextResponse.json({ error: 'License has expired' }, { status: 400 });
    }

    if (license.maxUses && license.usedCount >= license.maxUses) {
      return NextResponse.json({ error: 'License has reached maximum uses' }, { status: 400 });
    }

    // First create/update the user subscription with pending status
    await prisma.userSubscription.upsert({
      where: { userId: session.user.email },
      update: {
        isSubscribed: true,
        licenseKey: licenseKey,
        licenseExpiresAt: license.expiresAt,
      },
      create: {
        userId: session.user.email,
        isSubscribed: true,
        licenseKey: licenseKey,
        licenseExpiresAt: license.expiresAt,
      },
    });

    // Then create mail subscription
    const graphSubscription = await createMailSubscription(session.accessToken, session.user.email);
    if (!graphSubscription) {
      return NextResponse.json({ error: 'Failed to create mail subscription' }, { status: 500 });
    }

    // Update with webhook details
    await prisma.userSubscription.update({
      where: { userId: session.user.email },
      data: {
        webhookId: graphSubscription.id,
        webhookExpiresAt: new Date(graphSubscription.expirationDateTime),
        lastWebhookRenewal: new Date(),
      },
    });

    // Update license usage
    await prisma.license.update({
      where: { key: licenseKey },
      data: {
        usedCount: { increment: 1 },
        redeemedBy: {
          set: license.redeemedBy ? `${license.redeemedBy},${session.user.email}` : session.user.email
        }
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error redeeming license:', error);
    return NextResponse.json({ error: 'Failed to redeem license' }, { status: 500 });
  }
}

// Endpoint to check license status
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const subscription = await prisma.userSubscription.findUnique({
      where: { userId: session.user.email }
    });

    const hasValidLicense = subscription?.licenseKey && 
      (!subscription.licenseExpiresAt || subscription.licenseExpiresAt > new Date());

    return NextResponse.json({ hasValidLicense });
  } catch (error) {
    // Fix error handling
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error checking license:', { message: errorMessage });
    return NextResponse.json({ error: 'Failed to check license' }, { status: 500 });
  }
} 