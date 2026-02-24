
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

import { authenticatedApiCall as apiCall } from "./apiClient";

// Cloud Storage with E2E Encryption (via server API)
class SupabaseEncryptedNoteStorage implements NoteStorage {

    async getNotes(owner?: string): Promise<Record<string, TransactionNote>> {
        if (!owner) return {};
        const sessionKey = getSessionKey();

        if (!sessionKey) {
            console.warn("No encryption key available. Cannot decrypt notes.");
            return {};
        }

        const { data, error } = await apiCall({
            action: 'get_encrypted_data',
            wallet_address: owner,
        });

        if (error || !data || !data.encrypted_notes) return {};

        // Skip if it's not valid encrypted data
        const encryptedNotes = data.encrypted_notes.trim();
        if (!encryptedNotes || encryptedNotes === '{}' || encryptedNotes === '[]' || encryptedNotes === 'null') {
            return {};
        }

        try {
            const notes = await decryptData(data.encrypted_notes, sessionKey);
            return notes as Record<string, TransactionNote>;
        } catch (e) {
            console.warn("Failed to decrypt notes. This is expected for legacy (pre-M-02) data. Clearing old data.");
            return {};
        }
    }

    async saveNote(note: TransactionNote, owner?: string): Promise<void> {
        if (!owner) return;
        const sessionKey = getSessionKey();
        if (!sessionKey) throw new Error("No encryption key available");

        const current = await this.getNotes(owner);
        current[note.signature] = note;

        const encryptedNotes = await encryptData(current, sessionKey);

        const { error } = await apiCall({
            action: 'save_encrypted_data',
            wallet_address: owner,
            encrypted_notes: encryptedNotes,
        });

        if (error) throw new Error(error);
    }

    async removeNote(signature: string, owner?: string): Promise<void> {
        if (!owner) return;
        const sessionKey = getSessionKey();
        if (!sessionKey) return;

        const current = await this.getNotes(owner);
        delete current[signature];

        const encryptedNotes = await encryptData(current, sessionKey);
        await apiCall({
            action: 'save_encrypted_data',
            wallet_address: owner,
            encrypted_notes: encryptedNotes,
        });
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
        return !!getSessionKey();
    }

    async getNotes(owner?: string): Promise<Record<string, TransactionNote>> {
        const localNotes = await this.local.getNotes(owner);

        if (this.isCloudReady() && owner) {
            try {
                const cloudNotes = await this.cloud.getNotes(owner);
                return { ...localNotes, ...cloudNotes };
            } catch (e) {
                console.warn("[NoteStorage] Cloud fetch failed, using local only", e);
            }
        }

        return localNotes;
    }

    async saveNote(note: TransactionNote, owner?: string): Promise<void> {

        if (this.isCloudReady() && owner) {
            try {
                await this.cloud.saveNote(note, owner);
                return;
            } catch (e) {
                console.warn("[NoteStorage] Cloud save failed, fallback to local", e);
            }
        }

        await this.local.saveNote(note, owner);
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
