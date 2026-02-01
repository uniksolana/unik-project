/**
 * Shared Transaction Notes
 * 
 * Notes are encrypted using a key derived from the transaction signature.
 * Only sender and recipient can decrypt (they know the signature).
 * Admin cannot read (they just see encrypted blobs).
 */

import { supabase } from "./supabaseClient";

// Derive encryption key from signature (using Web Crypto API)
async function deriveKeyFromSignature(signature: string): Promise<CryptoKey> {
    const encoder = new TextEncoder();
    const data = encoder.encode(signature);

    // Create a hash of the signature
    const hashBuffer = await crypto.subtle.digest('SHA-256', data.buffer as ArrayBuffer);

    // Import as AES key
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

    // Generate random IV
    const iv = crypto.getRandomValues(new Uint8Array(12));

    // Encrypt
    const encrypted = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv: iv.buffer as ArrayBuffer },
        key,
        data.buffer as ArrayBuffer
    );

    // Combine IV + encrypted data and encode as base64
    const combined = new Uint8Array(iv.length + encrypted.byteLength);
    combined.set(iv);
    combined.set(new Uint8Array(encrypted), iv.length);

    return btoa(String.fromCharCode(...combined));
}

// Decrypt note with signature-derived key
async function decryptNote(encryptedNote: string, signature: string): Promise<string | null> {
    try {
        const key = await deriveKeyFromSignature(signature);

        // Decode base64
        const combined = Uint8Array.from(atob(encryptedNote), c => c.charCodeAt(0));

        // Extract IV and encrypted data
        const iv = combined.slice(0, 12);
        const encrypted = combined.slice(12);

        // Decrypt
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

export interface SharedNote {
    signature: string;
    note: string;
    sender: string;
    recipient: string;
}

/**
 * Save a shared note (encrypted with signature-derived key)
 * Both sender and recipient can later decrypt it.
 */
export async function saveSharedNote(
    signature: string,
    note: string,
    senderWallet: string,
    recipientWallet: string
): Promise<boolean> {
    try {
        console.log('[SharedNotes] Saving shared note for signature:', signature.slice(0, 8));

        const encryptedNote = await encryptNote(note, signature);

        const { error } = await supabase
            .from('transaction_notes')
            .insert({
                signature,
                encrypted_note: encryptedNote,
                sender_wallet: senderWallet,
                recipient_wallet: recipientWallet
            });

        if (error) {
            console.error('[SharedNotes] Save failed:', error);
            return false;
        }

        console.log('[SharedNotes] Saved successfully');
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
        const { data, error } = await supabase
            .from('transaction_notes')
            .select('encrypted_note')
            .eq('signature', signature)
            .single();

        if (error || !data?.encrypted_note) {
            return null;
        }

        return await decryptNote(data.encrypted_note, signature);
    } catch (e) {
        console.error('[SharedNotes] Error getting note:', e);
        return null;
    }
}

/**
 * Get multiple shared notes for a list of signatures
 */
export async function getSharedNotes(signatures: string[]): Promise<Record<string, string>> {
    if (signatures.length === 0) return {};

    try {
        const { data, error } = await supabase
            .from('transaction_notes')
            .select('signature, encrypted_note')
            .in('signature', signatures);

        if (error || !data) {
            return {};
        }

        const notes: Record<string, string> = {};

        await Promise.all(
            data.map(async (row) => {
                const decrypted = await decryptNote(row.encrypted_note, row.signature);
                if (decrypted) {
                    notes[row.signature] = decrypted;
                }
            })
        );

        console.log('[SharedNotes] Loaded', Object.keys(notes).length, 'shared notes');
        return notes;
    } catch (e) {
        console.error('[SharedNotes] Error getting notes:', e);
        return {};
    }
}
