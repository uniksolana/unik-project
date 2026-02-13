/**
 * Server-side wallet signature verification for API authentication.
 * Verifies that the caller owns the wallet they claim by checking
 * a signed message against the public key using tweetnacl.
 */
import nacl from 'tweetnacl';
import bs58 from 'bs58';

const AUTH_MESSAGE_PREFIX = 'Unik Pay Auth';

function getExpectedMessage(wallet: string): string {
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
        // Verify the message format is what we expect
        const expectedMessage = getExpectedMessage(walletAddress);
        if (message !== expectedMessage) {
            return false;
        }

        // Decode the public key from base58
        const publicKeyBytes = bs58.decode(walletAddress);

        // Decode the signature from base64
        const signatureBytes = Buffer.from(signature, 'base64');

        // Encode the message as bytes
        const messageBytes = new TextEncoder().encode(message);

        // Verify using tweetnacl (Ed25519)
        return nacl.sign.detached.verify(
            messageBytes,
            signatureBytes,
            publicKeyBytes
        );
    } catch (e) {
        console.error('[Auth] Signature verification failed:', e);
        return false;
    }
}
