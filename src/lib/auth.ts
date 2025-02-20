import { NextAuthOptions } from 'next-auth';
import AzureADProvider from 'next-auth/providers/azure-ad';
import GoogleProvider from 'next-auth/providers/google';
import { prisma } from '@/lib/prisma';
import { storeToken } from './tokenStore';

export const authOptions: NextAuthOptions = {
  providers: [
    AzureADProvider({
      clientId: process.env.AZURE_AD_CLIENT_ID!,
      clientSecret: process.env.AZURE_AD_CLIENT_SECRET!,
      tenantId: process.env.AZURE_AD_TENANT_ID!,
      authorization: {
        params: {
          scope: [
            'openid',
            'profile',
            'email',
            'User.Read',
            'Mail.ReadWrite',
            'Mail.Send',
            'offline_access',
          ].join(' '),
          prompt: 'consent',
        },
      },
    }),
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          scope: 'openid email profile https://www.googleapis.com/auth/gmail.labels https://www.googleapis.com/auth/gmail.modify',
          access_type: 'offline',
          prompt: 'consent',
          redirect_uri: 'https://gmail-folder-manager.netlify.app/api/auth/callback/google'
        },
      },
    }),
  ],
  callbacks: {
    async jwt({ token, account }) {

      if (account) {
        token.accessToken = account.access_token;
        token.refreshToken = account.refresh_token;
        token.expiresAt = account.expires_at! * 1000;
        token.provider = account.provider || (account.id_token?.includes('google') ? 'google' : 'microsoft');

        if (token.email) {
          await storeToken(token.email, {
            accessToken: account.access_token!,
            refreshToken: account.refresh_token,
            expiresAt: new Date(account.expires_at! * 1000),
          });
        }
      }

      if (token.expiresAt && Date.now() < token.expiresAt) {
        return token;
      }

      try {
        let response;

        if (token.provider === 'microsoft') {
          response = await fetch(
            `https://login.microsoftonline.com/${process.env.AZURE_AD_TENANT_ID}/oauth2/v2.0/token`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
              body: new URLSearchParams({
                client_id: process.env.AZURE_AD_CLIENT_ID!,
                client_secret: process.env.AZURE_AD_CLIENT_SECRET!,
                grant_type: 'refresh_token',
                refresh_token: token.refreshToken as string,
                scope: 'openid profile email Mail.ReadWrite Mail.Send offline_access',
              }),
            }
          );
        } else if (token.provider === 'google') {
          response = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
              client_id: process.env.GOOGLE_CLIENT_ID!,
              client_secret: process.env.GOOGLE_CLIENT_SECRET!,
              grant_type: 'refresh_token',
              refresh_token: token.refreshToken as string,
            }),
          });
        }

        const tokens = await response?.json();
        if (!response?.ok) throw tokens;

        if (token.email) {
          await storeToken(token.email, {
            accessToken: tokens.access_token,
            refreshToken: tokens.refresh_token ?? token.refreshToken,
            expiresAt: new Date(Date.now() + tokens.expires_in * 1000),
          });
        }

        return {
          ...token,
          accessToken: tokens.access_token,
          expiresAt: Date.now() + tokens.expires_in * 1000,
          refreshToken: tokens.refresh_token ?? token.refreshToken,
        };
      } catch (error) {
        console.error('Error refreshing access token', error);
        return { ...token, error: 'RefreshAccessTokenError' };
      }
    },
    async session({ session, token }) {
      console.log('Session Callback - Token:', {
        hasAccessToken: !!token.accessToken,
        error: token.error,
      });

      if (token) {
        session.accessToken = token.accessToken;
        session.error = token.error;
        if (typeof token.provider === 'string') {
          session.provider = token.provider;
        }
      }
      return session;
    },
  },
  events: {
    async signIn({ user, account }) {
      // Create or update the user subscription first.
      await prisma.userSubscription.upsert({
        where: { userId: user.email! },
        create: { userId: user.email! },
        update: {},
      });

      // Check the current subscription details.
      const existingUser = await prisma.userSubscription.findUnique({
        where: { userId: user.email! },
      });

      console.log('Sign In Event:', existingUser);
      if ((!existingUser || (existingUser && !existingUser.googleHistoryId)) && account && account.provider === 'google') {
        try {
          const sessionData = {
            accessToken: account.access_token,
            email: user.email,
            provider: account.provider,
          };
          const res = await fetch(`${process.env.NEXTAUTH_URL}/api/subscriptions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(sessionData),
          });
          console.log('Watch() response Response:', res);
          if (!res.ok) throw new Error('Failed to create subscription');
        } catch (err) {
          console.log(err);
        }
      }
    },
  },
  pages: {
    signIn: '/auth/signin',
    error: '/auth/error',
  },
  session: {
    maxAge: 30 * 24 * 60 * 60,
    updateAge: 24 * 60 * 60,
  },
  secret: process.env.NEXTAUTH_SECRET,
  debug: true,
};
