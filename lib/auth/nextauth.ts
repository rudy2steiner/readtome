import GoogleProvider from 'next-auth/providers/google';
import type { NextAuthConfig } from 'next-auth';
import { handleSignInUser } from './users';
import { isAuthEnabled } from './config';

const providers = isAuthEnabled()
  ? [
      GoogleProvider({
        clientId: process.env.AUTH_GOOGLE_ID!,
        clientSecret: process.env.AUTH_GOOGLE_SECRET!,
      }),
    ]
  : [];

export const authOptions: NextAuthConfig = {
  secret: process.env.AUTH_SECRET || 'build-placeholder-sessions-disabled',
  trustHost: process.env.AUTH_TRUST_HOST !== 'false',
  providers,
  pages: {
    signIn: '/auth/signin',
  },
  callbacks: {
    async redirect({ url, baseUrl }) {
      if (url.startsWith('/')) return `${baseUrl}${url}`;
      try {
        if (new URL(url).origin === baseUrl) return url;
      } catch {
        return baseUrl;
      }
      return baseUrl;
    },
    async session({ session, token }) {
      if (token.user && session.user) {
        session.user = { ...session.user, ...token.user };
      }
      return session;
    },
    async jwt({ token, user, account }) {
      if (!user || !account || !user.email) return token;

      const uuid = await handleSignInUser({
        email: user.email,
        name: user.name,
        image: user.image,
        provider: account.provider,
        providerAccountId: account.providerAccountId,
      });

      token.user = {
        uuid: uuid ?? undefined,
        email: user.email,
        name: user.name,
        image: user.image,
      };
      return token;
    },
  },
};
