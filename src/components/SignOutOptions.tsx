'use client'

import { signOut } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { LogOut, RefreshCw } from "lucide-react"

export function SignOutOptions() {
  const handleForceNewLogin = async () => {
    // Clear local session
    await signOut({ redirect: false });
    
    // Force new Microsoft login by redirecting to Microsoft's logout URL
    window.location.href = `https://login.microsoftonline.com/common/oauth2/v2.0/logout?post_logout_redirect_uri=${encodeURIComponent(window.location.origin)}`;
  };

  const handleSimpleSignOut = () => {
    signOut({ callbackUrl: '/' });
  };

  const handleHardSignOut = async () => {
    // Clear any stored tokens
    try {
      await fetch('/api/auth/clear-tokens', { method: 'POST' });
    } catch (error) {
      console.error('Error clearing tokens:', error);
    }
    // Then do a force new login
    handleForceNewLogin();
  };

  return (
    <div className="flex gap-2">
      <Button 
        variant="outline" 
        size="sm"
        onClick={handleSimpleSignOut}
      >
        <LogOut className="mr-2 h-4 w-4" />
        Sign out
      </Button>
      <Button 
        variant="destructive" 
        size="sm"
        onClick={handleForceNewLogin}
      >
        <RefreshCw className="mr-2 h-4 w-4" />
        Force New Login
      </Button>
      <Button 
        variant="destructive" 
        size="sm"
        onClick={handleHardSignOut}
      >
        <LogOut className="mr-2 h-4 w-4" />
        Hard Reset
      </Button>
    </div>
  );
} 