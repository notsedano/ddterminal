/**
 * Authentication Types
 * Types for Privy authentication and Supabase user management
 */

export interface PrivyUser {
  id: string;
  createdAt: Date;
  linkedAccounts: LinkedAccount[];
  email?: EmailAccount;
  phone?: PhoneAccount;
  wallet?: WalletAccount;
  google?: GoogleAccount;
  twitter?: TwitterAccount;
  discord?: DiscordAccount;
  github?: GithubAccount;
  farcaster?: FarcasterAccount;
}

export interface LinkedAccount {
  type: string;
  address?: string;
  chainType?: string;
  walletClient?: string;
  connectorType?: string;
  verifiedAt: Date;
  firstVerifiedAt: Date;
  latestVerifiedAt: Date;
}

export interface EmailAccount extends LinkedAccount {
  type: 'email';
  address: string;
}

export interface PhoneAccount extends LinkedAccount {
  type: 'phone';
  phoneNumber: string;
}

export interface WalletAccount extends LinkedAccount {
  type: 'wallet';
  address: string;
  chainType: 'ethereum' | 'solana';
  walletClient: string;
  connectorType: string;
}

export interface GoogleAccount extends LinkedAccount {
  type: 'google_oauth';
  email: string;
  name?: string;
  subject: string;
}

export interface TwitterAccount extends LinkedAccount {
  type: 'twitter_oauth';
  username: string;
  name?: string;
  subject: string;
}

export interface DiscordAccount extends LinkedAccount {
  type: 'discord_oauth';
  username: string;
  email?: string;
  subject: string;
}

export interface GithubAccount extends LinkedAccount {
  type: 'github_oauth';
  username: string;
  email?: string;
  name?: string;
  subject: string;
}

export interface FarcasterAccount extends LinkedAccount {
  type: 'farcaster';
  fid: number;
  username?: string;
  displayName?: string;
  pfp?: string;
  bio?: string;
  ownerAddress: string;
  signerPublicKey: string;
}

/**
 * Supabase User stored in database
 */
export interface SupabaseUser {
  id: string;
  privy_user_id: string;
  created_at: string;
  updated_at: string;
}

/**
 * User preferences stored in Supabase
 */
export interface UserPreferences {
  user_id: string;
  theme: 'dark' | 'light';
  terminal_config: TerminalConfig;
  updated_at: string;
}

/**
 * Terminal configuration
 */
export interface TerminalConfig {
  fontSize?: number;
  fontFamily?: string;
  theme?: TerminalTheme;
  cursorBlink?: boolean;
  cursorStyle?: 'block' | 'underline' | 'bar';
  lineHeight?: number;
  letterSpacing?: number;
}

export interface TerminalTheme {
  background?: string;
  foreground?: string;
  cursor?: string;
  selection?: string;
  black?: string;
  red?: string;
  green?: string;
  yellow?: string;
  blue?: string;
  magenta?: string;
  cyan?: string;
  white?: string;
  brightBlack?: string;
  brightRed?: string;
  brightGreen?: string;
  brightYellow?: string;
  brightBlue?: string;
  brightMagenta?: string;
  brightCyan?: string;
  brightWhite?: string;
}

/**
 * Auth state for the application
 */
export interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: PrivyUser | null;
  supabaseUserId: string | null;
}

/**
 * Auth context value
 */
export interface AuthContextValue extends AuthState {
  login: () => void;
  logout: () => Promise<void>;
  linkEmail: () => void;
  linkWallet: () => void;
  linkGoogle: () => void;
  linkTwitter: () => void;
  linkDiscord: () => void;
  linkGithub: () => void;
  linkFarcaster: () => void;
  unlinkAccount: (account: LinkedAccount) => Promise<void>;
  getAccessToken: () => Promise<string | null>;
}
