"use client";

import { useSession, signIn, signOut } from 'next-auth/react';
import { Button } from './button';
import Link from 'next/link';
import { LogOut, RefreshCw } from 'lucide-react';

export function Nav() {
  const { data: session, status } = useSession();
// console.log(session)
  const handleForceNewLogin = async () => {
    // Clear local session
    await signOut({ redirect: false });

    // Force new Microsoft login by redirecting to Microsoft's logout URL
    window.location.href = `https://login.microsoftonline.com/common/oauth2/v2.0/logout?post_logout_redirect_uri=${encodeURIComponent(window.location.origin)}`;
  };

  return (
    <nav className="border-b">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center">
            <Link href="/" className="text-xl font-bold">InBrief</Link>
          </div>
          <div className="flex items-center space-x-4">
            <Link href="#features" className="text-sm hover:text-primary">Features</Link>
            <Link href="#pricing" className="text-sm hover:text-primary">Pricing</Link>
            {status !== "authenticated" ? (
              <div>
                <Button
                  variant="outline"
                  onClick={() => signIn('azure-ad', {
                    callbackUrl: '/dashboard'
                  })}
                >
                  Sign in with Microsoft
                </Button>
                <Button
                  variant="outline"
                  onClick={() => signIn('google')}
                >
                  Sign in with Google
                </Button>
              </div>
            ) : (
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => window.location.href = (session.provider === 'google') ? '/google-dashboard' : '/dashboard'}
                >
                  Dashboard
                </Button>
                <Button
                  variant="destructive"
                  size="icon"
                  onClick={handleForceNewLogin}
                >
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}