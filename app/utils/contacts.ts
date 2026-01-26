
import { PublicKey } from "@solana/web3.js";

export interface Contact {
    alias: string;
    aliasOwner: string; // The owner pubkey at the time of saving
    version?: number;   // From on-chain data
    savedAt: number;
    notes?: string;
}

export interface ContactStorage {
    getContacts(): Promise<Contact[]>;
    saveContact(contact: Contact): Promise<void>;
    removeContact(alias: string): Promise<void>;
    updateContact(alias: string, contact: Contact): Promise<void>;
}

// LocalStorage implementation (can be swapped for DB later)
export class LocalContactStorage implements ContactStorage {
    private STORAGE_KEY = 'unik_contacts_v2';

    async getContacts(): Promise<Contact[]> {
        if (typeof window === 'undefined') return [];
        const data = localStorage.getItem(this.STORAGE_KEY);
        return data ? JSON.parse(data) : [];
    }

    async saveContact(contact: Contact): Promise<void> {
        const contacts = await this.getContacts();
        const existingIndex = contacts.findIndex(c => c.alias === contact.alias);

        if (existingIndex >= 0) {
            contacts[existingIndex] = contact;
        } else {
            contacts.push(contact);
        }

        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(contacts));
    }

    async removeContact(alias: string): Promise<void> {
        const contacts = await this.getContacts();
        const filtered = contacts.filter(c => c.alias !== alias);
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(filtered));
    }

    async updateContact(alias: string, update: Partial<Contact>): Promise<void> {
        const contacts = await this.getContacts();
        const index = contacts.findIndex(c => c.alias === alias);
        if (index >= 0) {
            contacts[index] = { ...contacts[index], ...update };
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(contacts));
        }
    }
}

export const contactStorage = new LocalContactStorage();
