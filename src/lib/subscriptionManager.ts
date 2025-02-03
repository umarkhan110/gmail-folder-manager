import { Client } from '@microsoft/microsoft-graph-client';
import { google } from 'googleapis';
import { prisma } from './prisma';

const RENEWAL_BUFFER_MINUTES = 60; // Renew subscription 1 hour before expiration
const SUBSCRIPTION_DURATION_MINUTES = 4230; // Maximum allowed by Microsoft (about 3 days)

interface GraphSubscription {
  id: string;
  expirationDateTime: string;
}

export async function deleteExistingSubscriptions(client: Client) {
  try {
    const subscriptions = await client.api('/subscriptions').get();
    console.log('Found existing subscriptions:', subscriptions.value.length);
    
    for (const sub of subscriptions.value) {
      console.log(`Deleting subscription: ${sub.id}`);
      await client.api(`/subscriptions/${sub.id}`).delete();
    }
  } catch (error) {
    console.error('Error deleting subscriptions:', error);
  }
}

// DELETE existing subscriptions (Google)
export async function deleteGoogleSubscriptions(auth: any, userId: string) {
  try {
    const gmail = google.gmail({ version: 'v1', auth });
    const watchResponse = await gmail.users.stop({ userId: 'me' });
    console.log(`Stopped Google Watch for ${userId}:`, watchResponse.data);
  } catch (error) {
    console.error('Error deleting Google subscriptions:', error);
  }
}

export async function createMailSubscription(accessToken: string, userId?: string): Promise<GraphSubscription | null> {
  const client = Client.init({
    authProvider: (done) => {
      done(null, accessToken);
    },
  });

  // Delete existing subscriptions first
  await deleteExistingSubscriptions(client);

  const expirationDateTime = new Date(Date.now() + SUBSCRIPTION_DURATION_MINUTES * 60 * 1000);

  const subscription = {
    changeType: 'created',
    notificationUrl: `${process.env.NEXT_PUBLIC_WEBHOOK_URL}/api/notifications`,
    resource: '/me/messages',
    expirationDateTime: expirationDateTime.toISOString(),
    clientState: process.env.WEBHOOK_SECRET,
  };

  try {
    const result = await client.api('/subscriptions').post(subscription);
    console.log('New subscription created:', result.id);

    if (userId) {
      // Store subscription details in database using the new schema
      await prisma.userSubscription.update({
        where: { userId },
        data: {
          webhookId: result.id,
          webhookExpiresAt: expirationDateTime,
          lastWebhookRenewal: new Date(),
        },
      });
    }

    return result;
  } catch (error) {
    console.error('Error creating subscription:', error);
    return null;
  }
}

// CREATE Google Subscription
export async function createGoogleMailSubscription(accessToken: string, userId: string): Promise<GraphSubscription | null> {
  try {
    const auth = new google.auth.OAuth2();
    auth.setCredentials({ access_token: accessToken });

    await deleteGoogleSubscriptions(auth, userId);

    const gmail = google.gmail({ version: 'v1', auth });
    const response = await gmail.users.watch({
      userId: 'me',
      requestBody: {
        topicName: process.env.GOOGLE_PUBSUB_TOPIC,
        labelIds: ['INBOX'],
      },
    });

    console.log('New Google subscription created:', response.data);

    return {
      id: response.data.historyId!,
      expirationDateTime: new Date(Date.now() + 3600 * 1000).toISOString(),
    };
  } catch (error) {
    console.error('Error creating Google subscription:', error);
    return null;
  }
}


export async function renewSubscription(accessToken: string, webhookId: string): Promise<boolean> {
  const client = Client.init({
    authProvider: (done) => {
      done(null, accessToken);
    },
  });

  const expirationDateTime = new Date(Date.now() + SUBSCRIPTION_DURATION_MINUTES * 60 * 1000);

  try {
    await client.api(`/subscriptions/${webhookId}`)
      .patch({
        expirationDateTime: expirationDateTime.toISOString(),
      });

    // Update subscription in database
    await prisma.userSubscription.update({
      where: { webhookId },
      data: {
        webhookExpiresAt: expirationDateTime,
        lastWebhookRenewal: new Date(),
      },
    });

    console.log(`Subscription ${webhookId} renewed until ${expirationDateTime}`);
    return true;
  } catch (error) {
    console.error('Error renewing subscription:', error);
    return false;
  }
}

export async function checkAndRenewSubscriptions(accessToken: string, forceRenew: boolean = false): Promise<void> {
  try {
    const subscriptions = await prisma.userSubscription.findMany({
      where: forceRenew ? {
        webhookId: { not: null }
      } : {
        webhookExpiresAt: {
          lt: new Date(Date.now() + RENEWAL_BUFFER_MINUTES * 60 * 1000),
        },
        webhookId: { not: null }
      },
    });

    console.log(`Found ${subscriptions.length} subscriptions to process`);

    for (const subscription of subscriptions) {
      if (subscription.webhookId) {
        console.log(`Processing subscription for ${subscription.userId}`);
        const renewed = await renewSubscription(accessToken, subscription.webhookId);
        console.log(`Renewal ${renewed ? 'succeeded' : 'failed'}`);
        
        if (!renewed) {
          console.log('Attempting to create new subscription');
          const newSubscription = await createMailSubscription(accessToken);
          if (!newSubscription) {
            console.error('Failed to create new subscription after renewal failure');
          }
        }
      }
    }
  } catch (error) {
    console.error('Error checking subscriptions:', error);
  }
}