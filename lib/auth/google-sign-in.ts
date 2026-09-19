import { signIn } from 'next-auth/react';

export function signInWithGoogle(callbackUrl = '/reader') {
  return signIn('google', { callbackUrl });
}
