/**
 * Privy Auth Provider
 * Wraps the application with Privy authentication context
 */

import { PrivyProvider } from '@privy-io/react-auth';
import type { ReactNode } from 'react';

const PRIVY_APP_ID = import.meta.env.VITE_PRIVY_APP_ID;

if (!PRIVY_APP_ID) {
  console.warn('Privy App ID not configured. Set VITE_PRIVY_APP_ID in .env');
}

interface PrivyAuthProviderProps {
  children: ReactNode;
}

/**
 * Privy Auth Provider Component
 * Configures Privy with login methods and appearance
 */
export function PrivyAuthProvider({ children }: PrivyAuthProviderProps) {
  if (!PRIVY_APP_ID) {
    // If Privy is not configured, render children without auth
    return <>{children}</>;
  }

  return (
    <PrivyProvider
      appId={PRIVY_APP_ID}
      config={{
        // Login methods configuration
        loginMethods: [
          'email',
          'wallet',
          'google',
          'twitter',
          'discord',
          'github',
          'farcaster',
        ],
        // Appearance configuration
        appearance: {
          theme: 'dark',
          accentColor: '#dc2626', // Red accent to match Daredevil theme
          logo: '/daredevil-logo.png',
          showWalletLoginFirst: false,
          walletChainType: 'ethereum-only',
        },
        // Embedded wallet configuration
        embeddedWallets: {
          ethereum: {
            createOnLogin: 'users-without-wallets',
          },
          showWalletUIs: true,
        },
        // Legal configuration
        legal: {
          termsAndConditionsUrl: '/terms',
          privacyPolicyUrl: '/privacy',
        },
        // MFA configuration
        mfa: {
          noPromptOnMfaRequired: false,
        },
      }}
    >
      {children}
    </PrivyProvider>
  );
}

export default PrivyAuthProvider;
