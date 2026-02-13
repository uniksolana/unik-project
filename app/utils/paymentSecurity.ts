
/**
 * Payment Security Utilities
 * 
 * Provides HMAC-signed payment links to prevent URL parameter tampering.
 * The HMAC secret lives server-side only (via API routes).
 */

/**
 * Request an HMAC signature for payment parameters from the server.
 */
export async function signPaymentParams(alias: string, amount: string, token: string): Promise<string | null> {
    try {
        const res = await fetch('/api/payment/sign', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ alias, amount, token }),
        });
        if (!res.ok) return null;
        const data = await res.json();
        return data.sig || null;
    } catch (e) {
        console.warn('[PaymentSecurity] Failed to sign payment params:', e);
        return null;
    }
}

/**
 * Verify an HMAC signature for payment parameters against the server.
 * Returns: 'valid' | 'invalid' | 'unsigned'
 */
export async function verifyPaymentSignature(
    alias: string,
    amount: string,
    token: string,
    sig: string | null
): Promise<'valid' | 'invalid' | 'unsigned'> {
    if (!sig) return 'unsigned';

    try {
        const res = await fetch('/api/payment/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ alias, amount, token, sig }),
        });
        if (!res.ok) return 'unsigned';
        const data = await res.json();
        return data.valid ? 'valid' : 'invalid';
    } catch (e) {
        console.warn('[PaymentSecurity] Failed to verify payment sig:', e);
        return 'unsigned';
    }
}
