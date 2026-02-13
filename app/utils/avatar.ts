
import { noteStorage, TransactionNote } from "./notes";
import { supabase } from "./supabaseClient";

// Helper to call server-side API
async function apiCall(body: Record<string, unknown>) {
    const res = await fetch('/api/data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    return res.json();
}

export const AVATAR_NOTE_ID = '_PROFILE_AVATAR_';

/**
 * Saves the avatar image.
 * Strategy:
 * 1. Always save as Encrypted Note (Private, Guaranteed to work for owner).
 * 2. Try to save to Supabase Storage (Public, allows others to see it, dependent on DB policies).
 */
export async function saveAvatar(file: File, owner: string): Promise<string> {
    if (!owner) throw new Error("Owner required");

    // 1. Resize & Convert to Base64 (Max 400x400 to keep note size manageable)
    const base64 = await resizeImageToBase64(file, 400, 400);

    // 2. Save Private Copy (Encrypted Note)
    const avatarNote: TransactionNote = {
        signature: AVATAR_NOTE_ID,
        note: base64, // The actual image data
        timestamp: Date.now(),
        token: 'UnikAvatar'
    };
    await noteStorage.saveNote(avatarNote, owner);

    // 3. Try Save Public Copy via server API (prevents spoofing)
    try {
        const { error } = await apiCall({
            action: 'upload_avatar',
            wallet_address: owner,
            avatar_base64: base64,
        });

        if (error) {
            console.warn("Public avatar upload failed:", error);
        }
    } catch (e) {
        console.warn("Public avatar upload exception:", e);
    }

    return base64;
}

/**
 * Retrieves the avatar for the current user (Private > Public).
 */
export async function getAvatar(owner: string): Promise<string | null> {
    if (!owner) return null;

    // 1. Try Encrypted Note (Fastest & Guaranteed for owner)
    try {
        const notes = await noteStorage.getNotes(owner);
        const avatarNote = notes[AVATAR_NOTE_ID];
        if (avatarNote && avatarNote.note && avatarNote.note.startsWith('data:image')) {
            return avatarNote.note;
        }
    } catch (e) {
        console.warn("Failed to fetch private avatar note", e);
    }

    // 2. Fallback to Public Storage (if private missing, e.g. new device/legacy data)
    return await getPublicAvatar(owner);
}

/**
 * Retrieves the public avatar for ANY user (Contacts).
 */
export async function getPublicAvatar(walletAddress: string): Promise<string | null> {
    if (!walletAddress) return null;
    try {
        const fileName = `${walletAddress}_avatar`;
        const { data: { publicUrl } } = supabase.storage
            .from('avatars')
            .getPublicUrl(fileName);

        if (!publicUrl) return null;

        // Check availability (optional, might slow down listing)
        // For UI, we usually return the URL and let <img onerror> handle it.
        return `${publicUrl}?t=${Date.now()}`;
    } catch (e) {
        return null;
    }
}

export async function removeAvatar(owner: string): Promise<void> {
    if (!owner) return;

    // Remove Private
    await noteStorage.removeNote(AVATAR_NOTE_ID, owner);

    // Remove Public via server API
    try {
        await apiCall({ action: 'remove_avatar', wallet_address: owner });
    } catch (e) { /* ignore */ }
}

/**
 * Helper to resize image and return Base64 string
 */
function resizeImageToBase64(file: File, maxWidth: number, maxHeight: number): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target?.result as string;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;

                if (width > height) {
                    if (width > maxWidth) {
                        height *= maxWidth / width;
                        width = maxWidth;
                    }
                } else {
                    if (height > maxHeight) {
                        width *= maxHeight / height;
                        height = maxHeight;
                    }
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx?.drawImage(img, 0, 0, width, height);

                // Compress to JPEG 0.8 quality to save space
                resolve(canvas.toDataURL('image/jpeg', 0.8));
            };
            img.onerror = (e) => reject(e);
        };
        reader.onerror = (e) => reject(e);
    });
}
