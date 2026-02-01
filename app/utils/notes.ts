
import { supabase } from "./supabaseClient";
import { encryptData, decryptData } from "./crypto";
import { getSessionKey } from "./sessionState";

export interface TransactionNote {
    signature: string;
    note: string;
    recipient?: string;
    amount?: string;
    token?: string;
    timestamp: number;
}

export interface NoteStorage {
    getNotes(owner?: string): Promise<Record<string, TransactionNote>>;
    saveNote(note: TransactionNote, owner?: string): Promise<void>;
    removeNote(signature: string, owner?: string): Promise<void>;
}

// Cloud Storage with E2E Encryption (same table as contacts, different column)
class SupabaseEncryptedNoteStorage implements NoteStorage {

    async getNotes(owner?: string): Promise<Record<string, TransactionNote>> {
        if (!owner) return {};
        const sessionKey = getSessionKey();

        if (!sessionKey) {
            console.warn("No encryption key available. Cannot decrypt notes.");
            return {};
        }

        const { data, error } = await supabase
            .from('user_encrypted_data')
            .select('encrypted_notes')
            .eq('wallet_address', owner)
            .single();

        if (error || !data || !data.encrypted_notes) return {};

        // Skip if it's not valid encrypted data (empty objects, plain JSON, etc)
        const encryptedNotes = data.encrypted_notes.trim();
        if (!encryptedNotes || encryptedNotes === '{}' || encryptedNotes === '[]' || encryptedNotes === 'null') {
            return {};
        }

        try {
            const notes = await decryptData(data.encrypted_notes, sessionKey);
            return notes as Record<string, TransactionNote>;
        } catch (e) {
            console.error("Failed to decrypt notes:", e);
            return {};
        }
    }

    async saveNote(note: TransactionNote, owner?: string): Promise<void> {
        if (!owner) return;
        const sessionKey = getSessionKey();
        if (!sessionKey) throw new Error("No encryption key available");

        // 1. Get current notes
        const current = await this.getNotes(owner);

        // 2. Add/Update note
        current[note.signature] = note;

        // 3. Encrypt & Upload
        const encryptedNotes = await encryptData(current, sessionKey);

        // Use update instead of upsert to avoid NOT NULL constraint on encrypted_blob
        const { error } = await supabase
            .from('user_encrypted_data')
            .update({
                encrypted_notes: encryptedNotes,
                updated_at: new Date().toISOString()
            })
            .eq('wallet_address', owner);

        if (error) throw error;
    }

    async removeNote(signature: string, owner?: string): Promise<void> {
        if (!owner) return;
        const sessionKey = getSessionKey();
        if (!sessionKey) return;

        const current = await this.getNotes(owner);
        delete current[signature];

        const encryptedNotes = await encryptData(current, sessionKey);
        await supabase
            .from('user_encrypted_data')
            .update({
                encrypted_notes: encryptedNotes,
                updated_at: new Date().toISOString()
            })
            .eq('wallet_address', owner);
    }
}

// Legacy Local Storage (Fallback)
class LocalNoteStorage implements NoteStorage {
    private STORAGE_KEY = 'unik_transaction_notes';

    async getNotes(owner?: string): Promise<Record<string, TransactionNote>> {
        if (typeof window === 'undefined') return {};
        const data = localStorage.getItem(this.STORAGE_KEY);
        return data ? JSON.parse(data) : {};
    }

    async saveNote(note: TransactionNote, owner?: string): Promise<void> {
        const notes = await this.getNotes();
        notes[note.signature] = note;
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(notes));
    }

    async removeNote(signature: string, owner?: string): Promise<void> {
        const notes = await this.getNotes();
        delete notes[signature];
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(notes));
    }
}

// Smart facade that decides which storage to use
class SmartNoteStorage implements NoteStorage {
    private cloud = new SupabaseEncryptedNoteStorage();
    private local = new LocalNoteStorage();

    private isCloudReady() {
        const ready = !!getSessionKey();
        console.log('[NoteStorage] Cloud ready:', ready);
        return ready;
    }

    async getNotes(owner?: string): Promise<Record<string, TransactionNote>> {
        console.log('[NoteStorage] Getting notes for:', owner?.slice(0, 8));

        if (this.isCloudReady() && owner) {
            try {
                const cloudNotes = await this.cloud.getNotes(owner);
                console.log('[NoteStorage] Got cloud notes:', Object.keys(cloudNotes).length);
                return cloudNotes;
            } catch (e) {
                console.warn("[NoteStorage] Cloud fetch failed, fallback to local", e);
            }
        }

        const localNotes = await this.local.getNotes(owner);
        console.log('[NoteStorage] Got local notes:', Object.keys(localNotes).length);
        return localNotes;
    }

    async saveNote(note: TransactionNote, owner?: string): Promise<void> {
        console.log('[NoteStorage] Saving note:', note.note, 'for signature:', note.signature?.slice(0, 8));

        if (this.isCloudReady() && owner) {
            try {
                await this.cloud.saveNote(note, owner);
                console.log('[NoteStorage] Saved to cloud successfully');
                return;
            } catch (e) {
                console.warn("[NoteStorage] Cloud save failed, fallback to local", e);
            }
        }

        await this.local.saveNote(note, owner);
        console.log('[NoteStorage] Saved to local storage');
    }

    async removeNote(signature: string, owner?: string): Promise<void> {
        if (this.isCloudReady() && owner) {
            try {
                await this.cloud.removeNote(signature, owner);
                return;
            } catch (e) {
                console.warn("[NoteStorage] Cloud remove failed, fallback to local", e);
            }
        }
        await this.local.removeNote(signature, owner);
    }
}

export const noteStorage = new SmartNoteStorage();

