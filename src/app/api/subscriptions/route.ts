import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createMailSubscription, deleteExistingSubscriptions, checkAndRenewSubscriptions, createGoogleMailSubscription } from '@/lib/subscriptionManager';
import { storeToken } from '@/lib/tokenStore';
import { PrismaClient } from '@prisma/client';
import { Client } from '@microsoft/microsoft-graph-client';
import { prisma } from '@/lib/prisma';

const prismaClient = new PrismaClient();

// Get subscription status
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const subscription = await prisma.userSubscription.findUnique({
      where: { userId: session.user.email }
    });

    return NextResponse.json({ isSubscribed: subscription?.isSubscribed ?? false });
  } catch (error) {
    // Fix error handling
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error fetching subscription status:', { message: errorMessage });
    return NextResponse.json({
      error: 'Failed to fetch subscription status',
      details: errorMessage
    }, { status: 500 });
  }
}

// Create subscription
export async function POST() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.accessToken || !session.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check and renew any existing subscriptions
    await checkAndRenewSubscriptions(session.accessToken);

    // Store the token with proper expiration
    await storeToken(session.user.email, {
      accessToken: session.accessToken,
      expiresAt: new Date(Date.now() + 3600 * 1000) // 1 hour
    });

    let subscription = null;

    if (session.provider === 'microsoft') {
      subscription = await createMailSubscription(session.accessToken, session.user.email);
    } else if (session.provider === 'google') {
      subscription = await createGoogleMailSubscription(session.accessToken, session.user.email);
    }
    
    if (!subscription) {
      throw new Error('Failed to create subscription');
    }

    // Store complete subscription details
    await prisma.userSubscription.upsert({
      where: { userId: session.user.email },
      update: { 
        isSubscribed: true,
        // provider: session.provider,
        webhookId: subscription.id,
        webhookExpiresAt: new Date(subscription.expirationDateTime),
        lastWebhookRenewal: new Date(),
      },
      create: { 
        userId: session.user.email,
        isSubscribed: true,
        // provider: session.provider,
        webhookId: subscription.id,
        webhookExpiresAt: new Date(subscription.expirationDateTime),
        lastWebhookRenewal: new Date(),
      }
    });

    return NextResponse.json({ isSubscribed: true });
  } catch (error) {
    console.error('Error creating subscription:', error instanceof Error ? error.message : error);
    return NextResponse.json({ 
      error: 'Failed to create subscription',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// Delete subscription
export async function DELETE() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.accessToken || !session.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const client = Client.init({
      authProvider: (done) => {
        done(null, session.accessToken || null);
      },
    });

    await deleteExistingSubscriptions(client);
    
    await prismaClient.userSubscription.upsert({
      where: { userId: session.user.email },
      update: { isSubscribed: false },
      create: { 
        userId: session.user.email,
        isSubscribed: false 
      }
    });

    return NextResponse.json({ isSubscribed: false });
  } catch (error) {
    console.error('Error deleting subscription:', error instanceof Error ? error.message : error);
    return NextResponse.json({ 
      error: 'Failed to delete subscription',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  } finally {
    await prismaClient.$disconnect();
  }
}
