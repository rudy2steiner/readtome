'use client';

import { signOut, useSession } from 'next-auth/react';
import { useTranslations } from 'next-intl';
import { LogOut } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { isAuthUiEnabled, isBillingEnabled } from '@/lib/config/features';
import { signInWithGoogle } from '@/lib/auth/google-sign-in';
import { Link, usePathname } from '@/lib/navigation';

export function AuthButton() {
  const t = useTranslations('auth');
  const { data: session, status } = useSession();
  const pathname = usePathname();

  if (!isAuthUiEnabled) return null;

  if (status === 'loading') {
    return <span className="h-8 w-8 animate-pulse rounded-full bg-muted" aria-hidden />;
  }

  if (!session?.user) {
    const callbackUrl = pathname && pathname !== '/auth/signin' ? pathname : '/reader';
    return (
      <button type="button" className="site-nav-link" onClick={() => void signInWithGoogle(callbackUrl)}>
        {t('signIn')}
      </button>
    );
  }

  const label = session.user.name || session.user.email || t('account');
  const initials = label.slice(0, 1).toUpperCase();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="h-8 gap-2 px-2">
          <Avatar className="h-6 w-6">
            <AvatarImage src={session.user.image || undefined} alt="" />
            <AvatarFallback className="text-[10px]">{initials}</AvatarFallback>
          </Avatar>
          <span className="hidden max-w-[120px] truncate text-sm sm:inline">{label}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="font-normal">
          <div className="truncate text-sm font-medium">{label}</div>
          {session.user.email ? <div className="truncate text-xs text-muted-foreground">{session.user.email}</div> : null}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {isBillingEnabled && (
          <DropdownMenuItem asChild>
            <Link href="/account">{t('usage')}</Link>
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onClick={() => void signOut({ callbackUrl: '/' })}>
          <LogOut className="mr-2 h-4 w-4" />
          {t('signOut')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
