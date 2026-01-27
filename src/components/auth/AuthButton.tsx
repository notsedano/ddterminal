/**
 * Auth Button Component
 * Login/logout button with user menu
 */

import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/Button';
import { LogIn, LogOut, User, Wallet, Mail, ChevronDown, Loader2 } from 'lucide-react';

interface AuthButtonProps {
  variant?: 'default' | 'ghost' | 'outline';
  size?: 'sm' | 'default' | 'lg';
  showUserMenu?: boolean;
}

/**
 * Get display name from Privy user
 */
function getDisplayName(privyUser: ReturnType<typeof useAuth>['privyUser']): string {
  if (!privyUser) return 'User';

  // Check for email
  const email = privyUser.email?.address;
  if (email) return email.split('@')[0];

  // Check for wallet
  const wallet = privyUser.wallet?.address;
  if (wallet) return `${wallet.slice(0, 6)}...${wallet.slice(-4)}`;

  // Check for Google
  const google = privyUser.google;
  if (google && 'name' in google) return google.name as string;

  // Check for Twitter
  const twitter = privyUser.twitter;
  if (twitter && 'username' in twitter) return `@${twitter.username}`;

  // Check for Discord
  const discord = privyUser.discord;
  if (discord && 'username' in discord) return discord.username as string;

  // Check for GitHub
  const github = privyUser.github;
  if (github && 'username' in github) return github.username as string;

  // Check for Farcaster
  const farcaster = privyUser.farcaster;
  if (farcaster && 'username' in farcaster) return `@${farcaster.username}`;

  return 'User';
}

/**
 * Get avatar URL from Privy user
 */
function getAvatarUrl(privyUser: ReturnType<typeof useAuth>['privyUser']): string | null {
  if (!privyUser) return null;

  // Check for Farcaster PFP
  const farcaster = privyUser.farcaster;
  if (farcaster && 'pfp' in farcaster) return farcaster.pfp as string;

  return null;
}

export function AuthButton({
  variant = 'default',
  size = 'default',
  showUserMenu = true,
}: AuthButtonProps) {
  const {
    isAuthenticated,
    isLoading,
    login,
    logout,
    privyUser,
    isMigrating,
    migrationProgress,
  } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  // Loading state
  if (isLoading) {
    return (
      <Button variant={variant} size={size} disabled>
        <Loader2 className="w-4 h-4 animate-spin mr-2" />
        Loading...
      </Button>
    );
  }

  // Migration in progress
  if (isMigrating && migrationProgress) {
    return (
      <Button variant={variant} size={size} disabled>
        <Loader2 className="w-4 h-4 animate-spin mr-2" />
        {migrationProgress.stage}
      </Button>
    );
  }

  // Not authenticated - show login button
  if (!isAuthenticated) {
    return (
      <Button variant={variant} size={size} onClick={login}>
        <LogIn className="w-4 h-4 mr-2" />
        Sign In
      </Button>
    );
  }

  const displayName = getDisplayName(privyUser);
  const avatarUrl = getAvatarUrl(privyUser);

  // Authenticated - show user button
  if (!showUserMenu) {
    return (
      <Button variant={variant} size={size} onClick={logout}>
        <LogOut className="w-4 h-4 mr-2" />
        Sign Out
      </Button>
    );
  }

  return (
    <div className="relative">
      <Button
        variant={variant}
        size={size}
        onClick={() => setMenuOpen(!menuOpen)}
        className="flex items-center gap-2"
      >
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt={displayName}
            className="w-5 h-5 rounded-full"
          />
        ) : (
          <User className="w-4 h-4" />
        )}
        <span className="max-w-[120px] truncate">{displayName}</span>
        <ChevronDown className={`w-4 h-4 transition-transform ${menuOpen ? 'rotate-180' : ''}`} />
      </Button>

      {menuOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setMenuOpen(false)}
          />
          {/* Menu */}
          <div className="absolute right-0 top-full mt-2 w-64 bg-zinc-900 border border-zinc-800 rounded-lg shadow-xl z-50">
            <div className="p-4 border-b border-zinc-800">
              <p className="text-sm text-zinc-400">Signed in as</p>
              <p className="text-sm font-medium text-white truncate">{displayName}</p>
            </div>
            <div className="p-2">
              {/* Linked accounts */}
              <div className="px-2 py-1 text-xs text-zinc-500 uppercase">Linked Accounts</div>
              {privyUser?.linkedAccounts.map((account, index) => (
                <div
                  key={index}
                  className="flex items-center gap-2 px-2 py-1.5 text-sm text-zinc-300"
                >
                  {account.type === 'email' && <Mail className="w-4 h-4" />}
                  {account.type === 'wallet' && <Wallet className="w-4 h-4" />}
                  {!['email', 'wallet'].includes(account.type) && (
                    <User className="w-4 h-4" />
                  )}
                  <span className="truncate">
                    {account.type === 'email' && (account as { address?: string }).address}
                    {account.type === 'wallet' && `${(account as { address?: string }).address?.slice(0, 6)}...${(account as { address?: string }).address?.slice(-4)}`}
                    {account.type === 'google_oauth' && 'Google'}
                    {account.type === 'twitter_oauth' && `@${(account as { username?: string }).username}`}
                    {account.type === 'discord_oauth' && (account as { username?: string }).username}
                    {account.type === 'github_oauth' && (account as { username?: string }).username}
                    {account.type === 'farcaster' && `@${(account as { username?: string }).username}`}
                  </span>
                </div>
              ))}
            </div>
            <div className="p-2 border-t border-zinc-800">
              <button
                onClick={() => {
                  setMenuOpen(false);
                  logout();
                }}
                className="w-full flex items-center gap-2 px-2 py-2 text-sm text-red-400 hover:bg-zinc-800 rounded-md transition-colors"
              >
                <LogOut className="w-4 h-4" />
                Sign Out
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default AuthButton;
