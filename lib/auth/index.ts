import NextAuth from 'next-auth';
import { authOptions } from './nextauth';

export const { handlers, signIn, signOut, auth } = NextAuth(authOptions);
