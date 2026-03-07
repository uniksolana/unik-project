/**
 * Authenticated API client for /api/data calls.
 * Automatically includes wallet authentication headers.
 */
import { getAuthToken } from './authState';

export async function authenticatedApiCall(body: Record<string, unknown>) {
    const authToken = getAuthToken();

    // Include auth credentials if available
    // Always attach auth when token exists (some actions like get_shared_notes
    // don't send wallet_address but still need auth for the MED-02 filter)
    if (authToken) {
        body.auth_wallet = authToken.wallet;
        body.auth_signature = authToken.signature;
        body.auth_message = authToken.message;
    }

    const res = await fetch('/api/data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    return res.json();
}
