
// Client-side encryption utility using Web Crypto API (AES-GCM)

// 1. Derive a symmetric key from the user's signature
export async function deriveKeyFromSignature(signature: string, salt: string = "unik-salt-v1"): Promise<CryptoKey> {
    const enc = new TextEncoder();
    const keyMaterial = await window.crypto.subtle.importKey(
        "raw",
        enc.encode(signature + salt) as BufferSource,
        "PBKDF2",
        false,
        ["deriveBits", "deriveKey"]
    );

    return window.crypto.subtle.deriveKey(
        {
            name: "PBKDF2",
            salt: enc.encode(salt) as BufferSource,
            iterations: 100000,
            hash: "SHA-256"
        },
        keyMaterial,
        { name: "AES-GCM", length: 256 },
        true,
        ["encrypt", "decrypt"]
    );
}

// 2. Encrypt data
export async function encryptData(data: any, key: CryptoKey): Promise<string> {
    const enc = new TextEncoder();
    const iv = window.crypto.getRandomValues(new Uint8Array(12)); // Random IV
    const encodedData = enc.encode(JSON.stringify(data));

    const encryptedContent = await window.crypto.subtle.encrypt(
        {
            name: "AES-GCM",
            iv: iv
        },
        key,
        encodedData as BufferSource
    );

    // Combine IV and Ciphertext for storage (Base64)
    const ivArr = Array.from(iv);
    const contentArr = Array.from(new Uint8Array(encryptedContent));
    const combined = JSON.stringify({ iv: ivArr, content: contentArr });

    return btoa(combined);
}

// 3. Decrypt data
export async function decryptData(encryptedBase64: string, key: CryptoKey): Promise<any> {
    try {
        const decoded = atob(encryptedBase64);
        const { iv, content } = JSON.parse(decoded);

        const ivUint8 = new Uint8Array(iv);
        const contentUint8 = new Uint8Array(content);

        const decryptedContent = await window.crypto.subtle.decrypt(
            {
                name: "AES-GCM",
                iv: ivUint8
            },
            key,
            contentUint8 as BufferSource
        );

        const dec = new TextDecoder();
        return JSON.parse(dec.decode(decryptedContent));
    } catch (e) {
        console.error("Decryption failed:", e);
        throw new Error("Failed to decrypt data. Invalid key or corrupted data.");
    }
}
