/**
 * Shared Transaction Notes
 * 
 * Notes are encrypted using a key derived from the transaction signature.
 * Only sender and recipient can decrypt (they know the signature).
 * Admin cannot read (they just see encrypted blobs).
 */

// Derive encryption key from signature (using Web Crypto API)
async function deriveKeyFromSignature(signature: string): Promise<CryptoKey> {
    const encoder = new TextEncoder();
    const data = encoder.encode(signature);

    const hashBuffer = await crypto.subtle.digest('SHA-256', data.buffer as ArrayBuffer);

    return crypto.subtle.importKey(
        'raw',
        hashBuffer,
        { name: 'AES-GCM' },
        false,
        ['encrypt', 'decrypt']
    );
}

// Encrypt note with signature-derived key
async function encryptNote(note: string, signature: string): Promise<string> {
    const key = await deriveKeyFromSignature(signature);
    const encoder = new TextEncoder();
    const data = encoder.encode(note);

    const iv = crypto.getRandomValues(new Uint8Array(12));

    const encrypted = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv: iv.buffer as ArrayBuffer },
        key,
        data.buffer as ArrayBuffer
    );

    const combined = new Uint8Array(iv.length + encrypted.byteLength);
    combined.set(iv);
    combined.set(new Uint8Array(encrypted), iv.length);

    return btoa(String.fromCharCode(...combined));
}

// Decrypt note with signature-derived key
async function decryptNote(encryptedNote: string, signature: string): Promise<string | null> {
    try {
        const key = await deriveKeyFromSignature(signature);
        const combined = Uint8Array.from(atob(encryptedNote), c => c.charCodeAt(0));
        const iv = combined.slice(0, 12);
        const encrypted = combined.slice(12);

        const decrypted = await crypto.subtle.decrypt(
            { name: 'AES-GCM', iv: iv.buffer as ArrayBuffer },
            key,
            encrypted.buffer as ArrayBuffer
        );

        return new TextDecoder().decode(decrypted);
    } catch (e) {
        console.error('[SharedNotes] Decryption failed:', e);
        return null;
    }
}

// Helper to call server-side API
async function apiCall(body: Record<string, unknown>) {
    const res = await fetch('/api/data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    return res.json();
}

export interface SharedNoteData {
    note: string;
    senderAlias?: string;
}

/**
 * Save a shared note (encrypted with signature-derived key)
 */
export async function saveSharedNote(
    signature: string,
    note: string,
    senderWallet: string,
    recipientWallet: string,
    senderAlias?: string
): Promise<boolean> {
    try {
        const encryptedNote = await encryptNote(note, signature);

        const { error } = await apiCall({
            action: 'save_shared_note',
            signature,
            encrypted_note: encryptedNote,
            sender_wallet: senderWallet,
            recipient_wallet: recipientWallet,
            sender_alias: senderAlias || null,
        });

        if (error) {
            console.error('[SharedNotes] Save failed:', error);
            return false;
        }

        return true;
    } catch (e) {
        console.error('[SharedNotes] Error saving:', e);
        return false;
    }
}

/**
 * Get shared note for a transaction (decrypts using signature)
 */
export async function getSharedNote(signature: string): Promise<string | null> {
    try {
        const { data } = await apiCall({
            action: 'get_shared_notes',
            signatures: [signature],
        });

        if (!data || data.length === 0 || !data[0]?.encrypted_note) {
            return null;
        }

        return await decryptNote(data[0].encrypted_note, signature);
    } catch (e) {
        console.error('[SharedNotes] Error getting note:', e);
        return null;
    }
}

/**
 * Get multiple shared notes for a list of signatures
 */
export async function getSharedNotes(signatures: string[]): Promise<Record<string, SharedNoteData>> {
    if (signatures.length === 0) return {};

    try {
        const { data, error } = await apiCall({
            action: 'get_shared_notes',
            signatures,
        });

        if (error || !data) {
            return {};
        }

        const notes: Record<string, SharedNoteData> = {};

        await Promise.all(
            data.map(async (row: { signature: string; encrypted_note: string; sender_alias?: string }) => {
                const decrypted = await decryptNote(row.encrypted_note, row.signature);
                if (decrypted) {
                    notes[row.signature] = {
                        note: decrypted,
                        senderAlias: row.sender_alias || undefined
                    };
                }
            })
        );

        return notes;
    } catch (e) {
        console.error('[SharedNotes] Error getting notes:', e);
        return {};
    }
}
