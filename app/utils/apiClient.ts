/**
 * Authenticated API client for /api/data calls.
 * Automatically includes wallet authentication headers.
 */
import { getAuthToken } from './authState';

export async function authenticatedApiCall(body: Record<string, unknown>) {
    const authToken = getAuthToken();

    // Include auth credentials if available
    if (authToken && body.wallet_address) {
        body.auth_wallet = authToken.wallet;
        body.auth_signature = authToken.signature;
        body.auth_message = authToken.message;

        // Debug
        // console.log("[ApiClient] Sending Auth:", { w: authToken.wallet, m: authToken.message });
    } else {
        console.warn("[ApiClient] No auth token found or wallet mismatch", { hasToken: !!authToken, target: body.wallet_address });
    }

    const res = await fetch('/api/data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    return res.json();
}
