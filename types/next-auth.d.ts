import type { DefaultSession } from 'next-auth';

declare module 'next-auth' {
  interface Session {
    user: DefaultSession['user'] & {
      uuid?: string;
    };
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    user?: {
      uuid?: string;
      email?: string | null;
      name?: string | null;
      image?: string | null;
    };
  }
}
