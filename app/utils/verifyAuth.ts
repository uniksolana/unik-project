/**
 * Server-side wallet signature verification for API authentication.
 * Verifies that the caller owns the wallet they claim by checking
 * a signed message against the public key using tweetnacl.
 */
import nacl from 'tweetnacl';
import bs58 from 'bs58';

const AUTH_MESSAGE_PREFIX = 'Unik Pay Auth';

function getExpectedMessage(wallet: string, timestamp?: string): string {
    if (timestamp) {
        return `${AUTH_MESSAGE_PREFIX}\nWallet: ${wallet}\nTimestamp: ${timestamp}`;
    }
    return `${AUTH_MESSAGE_PREFIX}\nWallet: ${wallet}`;
}

/**
 * Verify that a signature was produced by the claimed wallet.
 * 
 * @param walletAddress - Base58 public key
 * @param signature - Base64-encoded signature
 * @param message - The original signed message
 * @returns true if signature is valid
 */
export function verifyWalletSignature(
    walletAddress: string,
    signature: string,
    message: string
): boolean {
    try {
        // L-01: Extract timestamp from message if present to prevent replay attacks
        const timeMatch = message.match(/Timestamp:\s*(\d+)/);
        let timestampStr = timeMatch ? timeMatch[1] : undefined;

        // Verify the message format is what we expect
        const expectedMessage = getExpectedMessage(walletAddress, timestampStr);
        if (message !== expectedMessage) {
            console.error(`[Auth] Message mismatch.\nExpected: "${expectedMessage}"\nReceived: "${message}"`);
            return false;
        }

        // L-01: Verify timestamp freshness (5 minutes = 300,000 ms)
        if (timestampStr) {
            const timestamp = parseInt(timestampStr, 10);
            const now = Date.now();
            if (now - timestamp > 300000 || timestamp > now + 60000) {
                console.error(`[Auth] Signature expired or invalid timestamp: ${timestamp}`);
                return false;
            }
        } else {
            console.warn(`[Auth] No timestamp provided in auth message for ${walletAddress}. Vulnerable to replay attacks.`);
        }

        // Decode the public key from base58
        const publicKeyBytes = bs58.decode(walletAddress);

        // Decode the signature from base64
        const signatureBytes = Buffer.from(signature, 'base64');

        // Encode the message as bytes
        const messageBytes = new TextEncoder().encode(message);

        // Verify using tweetnacl (Ed25519)
        const isValid = nacl.sign.detached.verify(
            messageBytes,
            signatureBytes,
            publicKeyBytes
        );

        if (!isValid) {
            console.error(`[Auth] Signature verification failed for ${walletAddress}`);
        }
        return isValid;
    } catch (e) {
        console.error('[Auth] Verification exception:', e);
        return false;
    }
}
