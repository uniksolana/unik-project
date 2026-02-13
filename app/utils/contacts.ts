
import { PublicKey } from "@solana/web3.js";
import { encryptData, decryptData } from "./crypto";
import { getSessionKey } from "./sessionState";

export interface Contact {
    alias: string;
    aliasOwner: string; // The owner pubkey at the time of saving
    version?: number;   // From on-chain data
    savedAt: number;
    notes?: string;
}

export interface ContactStorage {
    getContacts(owner?: string): Promise<Contact[]>;
    saveContact(contact: Contact, owner?: string): Promise<void>;
    removeContact(alias: string, owner?: string): Promise<void>;
    updateContact(alias: string, update: Partial<Contact>, owner?: string): Promise<void>;
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

// 1. Cloud Storage with E2E Encryption (via server API)
class SupabaseEncryptedStorage implements ContactStorage {

    async getContacts(owner?: string): Promise<Contact[]> {
        if (!owner) return [];
        const sessionKey = getSessionKey();

        if (!sessionKey) {
            console.warn("No encryption key available. Cannot decrypt cloud contacts.");
            return [];
        }

        const { data, error } = await apiCall({
            action: 'get_encrypted_data',
            wallet_address: owner,
        });

        if (error || !data || !data.encrypted_blob) return [];

        try {
            const contacts = await decryptData(data.encrypted_blob, sessionKey);
            return contacts as Contact[];
        } catch (e) {
            console.error("Failed to decrypt contacts:", e);
            return [];
        }
    }

    async saveContact(contact: Contact, owner?: string): Promise<void> {
        if (!owner) return;
        const sessionKey = getSessionKey();
        if (!sessionKey) throw new Error("No encryption key available");

        const current = await this.getContacts(owner);
        const existingIndex = current.findIndex(c => c.alias === contact.alias);
        if (existingIndex >= 0) {
            current[existingIndex] = contact;
        } else {
            current.push(contact);
        }

        const encryptedBlob = await encryptData(current, sessionKey);

        const { error } = await apiCall({
            action: 'save_encrypted_data',
            wallet_address: owner,
            encrypted_blob: encryptedBlob,
        });

        if (error) throw new Error(error);
    }

    async removeContact(alias: string, owner?: string): Promise<void> {
        if (!owner) return;
        const sessionKey = getSessionKey();
        if (!sessionKey) return;

        const current = await this.getContacts(owner);
        const filtered = current.filter(c => c.alias !== alias);

        const encryptedBlob = await encryptData(filtered, sessionKey);
        await apiCall({
            action: 'save_encrypted_data',
            wallet_address: owner,
            encrypted_blob: encryptedBlob,
        });
    }

    async updateContact(alias: string, update: Partial<Contact>, owner?: string): Promise<void> {
        if (!owner) return;
        const current = await this.getContacts(owner);
        const index = current.findIndex(c => c.alias === alias);

        if (index >= 0) {
            current[index] = { ...current[index], ...update };
            const sessionKey = getSessionKey();
            if (!sessionKey) return;

            const encryptedBlob = await encryptData(current, sessionKey);
            await apiCall({
                action: 'save_encrypted_data',
                wallet_address: owner,
                encrypted_blob: encryptedBlob,
            });
        }
    }
}

// 2. Legacy Local Storage (Fallback or for unconnected users)
class LocalContactStorage implements ContactStorage {
    private STORAGE_KEY = 'unik_contacts_v2';

    async getContacts(owner?: string): Promise<Contact[]> {
        if (typeof window === 'undefined') return [];
        const data = localStorage.getItem(this.STORAGE_KEY);
        return data ? JSON.parse(data) : [];
    }

    async saveContact(contact: Contact, owner?: string): Promise<void> {
        const contacts = await this.getContacts();
        const existingIndex = contacts.findIndex(c => c.alias === contact.alias);
        if (existingIndex >= 0) {
            contacts[existingIndex] = contact;
        } else {
            contacts.push(contact);
        }
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(contacts));
    }

    async removeContact(alias: string, owner?: string): Promise<void> {
        const contacts = await this.getContacts();
        const filtered = contacts.filter(c => c.alias !== alias);
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(filtered));
    }

    async updateContact(alias: string, update: Partial<Contact>, owner?: string): Promise<void> {
        const contacts = await this.getContacts();
        const index = contacts.findIndex(c => c.alias === alias);
        if (index >= 0) {
            contacts[index] = { ...contacts[index], ...update };
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(contacts));
        }
    }
}

// 3. Facade that decides which storage to use
class SmartContactStorage implements ContactStorage {
    private cloud = new SupabaseEncryptedStorage();
    private local = new LocalContactStorage();

    private isCloudReady() {
        return !!getSessionKey();
    }

    async getContacts(owner?: string): Promise<Contact[]> {
        if (this.isCloudReady() && owner) {
            try {
                const contacts = await this.cloud.getContacts(owner);
                return contacts;
            } catch (e) {
                console.warn("Cloud fetch failed, fallback to local", e);
            }
        }
        return this.local.getContacts(owner);
    }

    async saveContact(contact: Contact, owner?: string): Promise<void> {
        if (this.isCloudReady() && owner) {
            await this.cloud.saveContact(contact, owner);
        } else {
            await this.local.saveContact(contact, owner);
        }
    }

    async removeContact(alias: string, owner?: string): Promise<void> {
        if (this.isCloudReady() && owner) {
            await this.cloud.removeContact(alias, owner);
        } else {
            await this.local.removeContact(alias, owner);
        }
    }

    async updateContact(alias: string, update: Partial<Contact>, owner?: string): Promise<void> {
        if (this.isCloudReady() && owner) {
            await this.cloud.updateContact(alias, update, owner);
        } else {
            await this.local.updateContact(alias, update, owner);
        }
    }
}

export const contactStorage = new SmartContactStorage();
