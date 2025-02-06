import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getStoredToken } from '@/lib/tokenStore';
import { renewSubscription } from '@/lib/subscriptionManager';
import { prisma } from '@/lib/prisma';

const ADMIN_EMAILS = ['thomaswarner228@outlook.com', 'harrystevenson2025@outlook.com'];

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email || !ADMIN_EMAILS.includes(session.user.email)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('\n=== Starting Manual Subscription Renewal ===');
    
    // Get current state
    const beforeSub = await prisma.userSubscription.findFirst({
      where: { 
        webhookId: { not: null },
        isSubscribed: true 
      }
    });

    console.log('\nBEFORE Renewal:');
    console.log({
      webhookExpires: beforeSub?.webhookExpiresAt,
      lastRenewal: beforeSub?.lastWebhookRenewal,
      licenseExpires: beforeSub?.licenseExpiresAt
    });

    // Force renewal regardless of expiration
    if (beforeSub?.webhookId) {
          const token = await getStoredToken(session?.user?.email);
      if (!token) {
        return NextResponse.json({ error: 'No valid access token available' }, { status: 401 });
      }
      await renewSubscription(token, beforeSub.webhookId);
    }

    // Get state after renewal
    const afterSub = await prisma.userSubscription.findFirst({
      where: { 
        webhookId: { not: null },
        isSubscribed: true 
      }
    });

    console.log('\nAFTER Renewal:');
    console.log({
      webhookExpires: afterSub?.webhookExpiresAt,
      lastRenewal: afterSub?.lastWebhookRenewal,
      licenseExpires: afterSub?.licenseExpiresAt,
      webhookExtendedBy: afterSub?.webhookExpiresAt && beforeSub?.webhookExpiresAt
        ? `${Math.round((afterSub.webhookExpiresAt.getTime() - beforeSub.webhookExpiresAt.getTime()) / (1000 * 60))} minutes`
        : 'N/A'
    });

    return NextResponse.json({ 
      success: true,
      details: {
        before: beforeSub,
        after: afterSub
      }
    });
  } catch (error) {
    console.error('Error renewing all subscriptions:', error);
    return NextResponse.json({ error: 'Failed to renew subscriptions' }, { status: 500 });
  }
} 