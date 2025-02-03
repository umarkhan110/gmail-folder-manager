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
      console.log('JWT Callback - Account:', {
        accessToken: !!account?.access_token,
        scopes: account?.scope,
      });

      if (account) {
        token.accessToken = account.access_token;
        token.refreshToken = account.refresh_token;
        token.expiresAt = account.expires_at! * 1000;
        token.provider = account.provider || (account.id_token?.includes('google') ? 'google' : 'microsoft');

        if (token.email) {
          await storeToken(token.email, {
            accessToken: account.access_token!,
            expiresAt: new Date(account.expires_at! * 1000),
          });
        }

        if (account.refresh_token) {
          await prisma.token.upsert({
            where: { id: `refresh_token_${token.provider}` },
            update: { value: account.refresh_token },
            create: { id: `refresh_token_${token.provider}`, value: account.refresh_token },
          });
        }
      }

      if (token.expiresAt && Date.now() < token.expiresAt) {
        return token;
      }

      try {
        let response;
        let tokens;

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

        tokens = await response?.json();
        if (!response?.ok) throw tokens;

        if (token.email) {
          await storeToken(token.email, {
            accessToken: tokens.access_token,
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
    async signIn({ user }) {
      await prisma.userSubscription.upsert({
        where: { userId: user.email! },
        create: { userId: user.email! },
        update: {},
      });
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
  debug: true,
};
