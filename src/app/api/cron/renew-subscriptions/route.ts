import { NextResponse } from 'next/server';
import { getStoredToken } from '@/lib/tokenStore';
import { checkAndRenewSubscriptions } from '@/lib/subscriptionManager';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.accessToken || !session.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    // Verify the request is from Vercel's cron
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET_KEY}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('\n=== Starting Automated Cron Renewal ===');

    // Get current state of subscriptions
    const beforeSubs = await prisma.userSubscription.findMany({
      where: {
        webhookId: { not: null },
        isSubscribed: true
      }
    });

    console.log('\nBEFORE Renewal:');
    beforeSubs.forEach(sub => {
      console.log({
        userId: sub.userId,
        webhookExpires: sub.webhookExpiresAt,
        lastRenewal: sub.lastWebhookRenewal,
        licenseExpires: sub.licenseExpiresAt
      });
    });

    const token = await getStoredToken(session.user?.email);
    if (!token) {
      return NextResponse.json({ error: 'No valid access token available' }, { status: 401 });
    }

    // Force renewal for testing
    await checkAndRenewSubscriptions(token, true);

    // Get state after renewal
    const afterSubs = await prisma.userSubscription.findMany({
      where: {
        webhookId: { not: null },
        isSubscribed: true
      }
    });

    console.log('\nAFTER Renewal:');
    afterSubs.forEach(sub => {
      const beforeSub = beforeSubs.find(b => b.webhookId === sub.webhookId);
      console.log({
        userId: sub.userId,
        webhookExpires: sub.webhookExpiresAt,
        lastRenewal: sub.lastWebhookRenewal,
        licenseExpires: sub.licenseExpiresAt,
        webhookExtendedBy: beforeSub && sub.webhookExpiresAt && beforeSub.webhookExpiresAt
          ? `${Math.round((sub.webhookExpiresAt.getTime() - beforeSub.webhookExpiresAt.getTime()) / (1000 * 60))} minutes`
          : 'N/A'
      });
    });

    console.log('=== Automated Renewal Complete ===\n');

    return NextResponse.json({
      success: true,
      details: {
        processed: afterSubs.length,
        before: beforeSubs.map(sub => ({
          userId: sub.userId,
          oldExpiry: sub.webhookExpiresAt
        })),
        after: afterSubs.map(sub => ({
          userId: sub.userId,
          newExpiry: sub.webhookExpiresAt
        }))
      }
    });
  } catch (error) {
    console.error('Cron job failed:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 