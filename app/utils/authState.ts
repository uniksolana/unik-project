
/**
 * API Authentication State
 * 
 * Stores a wallet-signed auth token in memory (never persisted).
 * Used to prove identity on every /api/data call.
 * 
 * Flow:
 * 1. User connects wallet and signs a message (RiskModal)
 * 2. We create a separate auth signature and store it here
 * 3. Every API call includes: wallet_address + auth_token + auth_message
 * 4. Server verifies the signature matches the wallet
 */

export interface AuthToken {
    wallet: string;        // Public key (base58)
    signature: string;     // Base64-encoded signature
    message: string;       // The signed message (for verification)
}

let currentAuthToken: AuthToken | null = null;

export const getAuthToken = (): AuthToken | null => currentAuthToken;
export const setAuthToken = (token: AuthToken) => { currentAuthToken = token; };
export const clearAuthToken = () => { currentAuthToken = null; };

/**
 * The standard auth message format.
 * Using a fixed prefix + wallet ensures uniqueness per wallet without requiring timestamps
 * (timestamps would cause issues with message re-signing on page refresh).
 */
export const AUTH_MESSAGE_PREFIX = 'Unik Pay Auth';
export function getAuthMessage(wallet: string): string {
    return `${AUTH_MESSAGE_PREFIX}\nWallet: ${wallet}\nTimestamp: ${Date.now()}`;
}
